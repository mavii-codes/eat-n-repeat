import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { decideStatusReplay, normalizeOrderStatus } from "@/services/sync/status-priority";

// ---------------------------------------------------------------------------
// Push — server-to-server sync from local to cloud
// Uses prisma.$executeRaw with ON DUPLICATE KEY UPDATE (MySQL specific)
// ---------------------------------------------------------------------------

export class SyncRepository {
  async upsertCustomers(customers: any[]) {
    for (const customer of customers) {
      const notificationPreferences =
        customer.notification_preferences !== undefined && customer.notification_preferences !== null
          ? JSON.stringify(customer.notification_preferences)
          : null;

      await prisma.$executeRaw`
        INSERT INTO customers (id, name, email, phone, password_hash, status, created_at, avatar_url, notification_preferences)
        VALUES (${customer.id}, ${customer.name}, ${customer.email}, ${customer.phone}, ${customer.password_hash}, ${customer.status}, ${customer.created_at}, ${customer.avatar_url}, ${notificationPreferences})
        ON DUPLICATE KEY UPDATE
          name=VALUES(name), phone=VALUES(phone), status=VALUES(status), avatar_url=VALUES(avatar_url)
      `;
    }
  }

  async upsertOrders(orders: any[]) {
    for (const order of orders) {
      const items =
        order.items !== undefined && order.items !== null && typeof order.items !== "string"
          ? JSON.stringify(order.items)
          : order.items;

      await prisma.$executeRaw`
        INSERT INTO orders (id, order_number, customer_id, customer_name, phone, address, service_area_id, type, items, subtotal, delivery_fee, total, status, delivery_person, assigned_role, assigned_at, estimated_delivery_time, notes, created_at, delivered_at, archived)
        VALUES (${order.id}, ${order.order_number}, ${order.customer_id}, ${order.customer_name}, ${order.phone}, ${order.address}, ${order.service_area_id}, ${order.type}, ${items}, ${order.subtotal}, ${order.delivery_fee}, ${order.total}, ${order.status}, ${order.delivery_person}, ${order.assigned_role}, ${order.assigned_at}, ${order.estimated_delivery_time}, ${order.notes}, ${order.created_at}, ${order.delivered_at}, ${order.archived})
        ON DUPLICATE KEY UPDATE
          status=VALUES(status), delivery_person=VALUES(delivery_person), notes=VALUES(notes), archived=VALUES(archived)
      `;
    }
  }

  async upsertPayments(payments: any[]) {
    for (const payment of payments) {
      await prisma.$executeRaw`
        INSERT INTO payments (id, order_id, payment_method, xendit_invoice_id, xendit_reference, amount, status, paid_at, created_at)
        VALUES (${payment.id}, ${payment.order_id}, ${payment.payment_method}, ${payment.xendit_invoice_id}, ${payment.xendit_reference}, ${payment.amount}, ${payment.status}, ${payment.paid_at}, ${payment.created_at})
        ON DUPLICATE KEY UPDATE status=VALUES(status), paid_at=VALUES(paid_at)
      `;
    }
  }

  async upsertStaffNotifications(staff_notifications: any[]) {
    for (const notif of staff_notifications) {
      await prisma.$executeRaw`
        INSERT INTO staff_notifications (id, user_id, type, title, message, related_order_id, is_read, created_at)
        VALUES (${notif.id}, ${notif.user_id}, ${notif.type}, ${notif.title}, ${notif.message}, ${notif.related_order_id}, ${notif.is_read}, ${notif.created_at})
        ON DUPLICATE KEY UPDATE is_read=VALUES(is_read)
      `;
    }
  }

  // ---------------------------------------------------------------------------
  // Offline — sync offline orders + stock deductions atomically
  // Uses prisma.$transaction for atomicity
  // Dedup stock deductions via ER_DUP_ENTRY guard
  // ---------------------------------------------------------------------------

  /**
   * Resolve a client order identifier to its database row, mirroring
   * findOrderByIdentifier: exact primary-key match first, then
   * order-number fallback preferring the real customer-owned row.
   */
  private async resolveDrainOrder(
    tx: any,
    identifier: string,
  ): Promise<{ id: string; orderNumber: string; status: string; total: any } | null> {
    if (!identifier) return null;
    const byId = await tx.$queryRaw<any[]>`
      SELECT id, order_number, status, total FROM orders WHERE id = ${identifier} LIMIT 1
    `;
    if (byId.length > 0) {
      const r = byId[0];
      return { id: r.id, orderNumber: r.order_number, status: r.status, total: r.total };
    }
    const twins = await tx.$queryRaw<any[]>`
      SELECT id, order_number, status, total, customer_id FROM orders
      WHERE order_number = ${identifier} ORDER BY created_at ASC
    `;
    if (twins.length === 0) return null;
    const pick = twins.find((o: any) => o.customer_id) ?? twins[0];
    return { id: pick.id, orderNumber: pick.order_number, status: pick.status, total: pick.total };
  }

  private async hasPaidPayment(tx: any, orderId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<any[]>`
      SELECT status FROM payments WHERE order_id = ${orderId} ORDER BY created_at DESC
    `;
    return rows.some((p: any) => String(p.status ?? "").toUpperCase() === "PAID");
  }

  /**
   * Dedicated offline mark-paid applier. Deliberately narrower than the
   * online markOrderAsPaid: it never touches order status, never writes
   * cash-shift rows, and never notifies (payment state stays independent).
   * Already-PAID orders are skipped so replays can never double-collect.
   */
  private async applyOfflinePayment(
    tx: any,
    orderIdParam: string,
    method: string,
    paidAt: Date,
  ): Promise<"applied" | "skipped"> {
    const order = await this.resolveDrainOrder(tx, orderIdParam);
    if (!order) {
      console.warn(`[offline-sync] payment for unknown order "${orderIdParam}" — dropped.`);
      return "skipped";
    }
    if (await this.hasPaidPayment(tx, order.id)) {
      console.info(`[offline-sync] order ${order.orderNumber} already PAID — replay skipped.`);
      return "skipped";
    }
    const existing = await tx.$queryRaw<any[]>`
      SELECT id FROM payments WHERE order_id = ${order.id} ORDER BY created_at DESC LIMIT 1
    `;
    const safeMethod = (method || "Cash").slice(0, 50);
    if (existing.length > 0) {
      await tx.$executeRaw`
        UPDATE payments SET status = 'PAID', paid_at = ${paidAt}, payment_method = ${safeMethod}
        WHERE id = ${existing[0].id}
      `;
    } else {
      await tx.$executeRaw`
        INSERT INTO payments (id, order_id, payment_method, amount, status, paid_at, created_at)
        VALUES (${crypto.randomUUID()}, ${order.id}, ${safeMethod}, ${Number(order.total) || 0}, 'PAID', ${paidAt}, ${new Date()})
      `;
    }
    console.info(`[offline-sync] order ${order.orderNumber} marked PAID (${safeMethod}).`);
    return "applied";
  }

  async executeOfflineSync(
    offline_orders: any[],
    offline_stock_transactions: any[],
    offline_payments: any[] = [],
    offline_status_changes: any[] = [],
  ) {
    await prisma.$transaction(async (tx) => {
      // Sync Offline Orders (INSERT IGNORE)
      if (offline_orders && offline_orders.length > 0) {
        for (const order of offline_orders) {
          // Idempotency guard: the offline queue must never resurrect an
          // order the server already created (e.g. an online checkout whose
          // journal entry outlived the success). order_number has no UNIQUE
          // constraint by design, so check explicitly and skip replays.
          // Genuine offline orders carry a new order_number and insert
          // normally below.
          const alreadyThere = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM orders WHERE order_number = ${order.id} LIMIT 1
          `;
          if (alreadyThere.length > 0) {
            continue;
          }

          const items =
            order.items !== undefined && order.items !== null && typeof order.items !== "string"
              ? JSON.stringify(order.items)
              : order.items;

          const createdAt = order.timestamp || new Date();

          // NOTE: no payment_method column exists on orders (payment data
          // lives in the payments table). Referencing one throws MySQL 1054
          // and rolls back the whole offline drain, so it must stay out.
          // address/notes ARE real columns: replayed offline orders keep the
          // customer's delivery address and notes (null when the journal
          // predates those fields).
          await tx.$executeRaw`
            INSERT IGNORE INTO orders (id, order_number, type, items, total, status, archived, created_at, address, notes)
            VALUES (${order.id}, ${order.id}, 'dine-in', ${items}, ${order.total}, ${order.status}, 0, ${createdAt}, ${order.address ?? null}, ${order.customerNotes ?? null})
          `;

          // Journaled cash sales replay as paid: mirror a PAID payment row
          // for rows THIS drain inserted (never for pre-existing rows, and
          // never when a payment already exists — no double-collect).
          // NOTE: online checkout never deducts stock either, so replayed
          // rows not deducting keeps offline and online consistent.
          try {
            const inserted = await tx.$queryRaw<any[]>`
              SELECT id FROM orders WHERE id = ${order.id} LIMIT 1
            `;
            if (inserted.length > 0 && order.paid && !(await this.hasPaidPayment(tx, order.id))) {
              await tx.$executeRaw`
                INSERT INTO payments (id, order_id, payment_method, amount, status, paid_at, created_at)
                VALUES (${crypto.randomUUID()}, ${order.id}, 'Cash', ${Number(order.total) || 0}, 'PAID', ${createdAt}, ${new Date()})
              `;
              console.info(`[offline-sync] replayed order ${order.id} recorded PAID (cash).`);
            }
          } catch (e: any) {
            console.warn(`[offline-sync] payment mirror for ${order.id} failed: ${e?.message ?? e}`);
          }
        }
      }

      // Sync Offline Stock Deductions idempotently
      if (offline_stock_transactions && offline_stock_transactions.length > 0) {
        for (const txItem of offline_stock_transactions) {
          const transactionDate = txItem.timestamp || new Date();
          try {
            await tx.$executeRaw`
              INSERT INTO offline_stock_transactions (id, stock_item_id, quantity_deducted, order_id, staff_id, transaction_date)
              VALUES (${txItem.id}, ${txItem.stockItemId}, ${txItem.quantityDeducted}, ${txItem.orderId}, ${txItem.staffId}, ${transactionDate})
            `;

            // If insert succeeds, deduct stock
            await tx.$executeRaw`
              UPDATE stock_items SET quantity = GREATEST(0, quantity - ${txItem.quantityDeducted}) WHERE id = ${txItem.stockItemId}
            `;
          } catch (e: any) {
            // If ER_DUP_ENTRY, already synced — skip double deduct
            const code = e?.code;
            const message = String(e?.message ?? "");
            const isDup =
              code === "ER_DUP_ENTRY" ||
              message.includes("ER_DUP_ENTRY") ||
              message.includes("Duplicate entry");
            if (!isDup) {
              throw e;
            }
          }
        }
      }

      // Queued mark-paid collections (Gap 1). Each row is independent:
      // one bad row is logged and skipped, never failing the batch.
      if (offline_payments && offline_payments.length > 0) {
        for (const pay of offline_payments) {
          try {
            const identifier = String(pay?.orderId ?? pay?.order_id ?? "");
            if (!identifier) {
              console.warn("[offline-sync] payment entry without order id — dropped.");
              continue;
            }
            const paidAt = pay?.paidAt ? new Date(pay.paidAt) : new Date();
            await this.applyOfflinePayment(
              tx,
              identifier,
              String(pay?.method ?? pay?.payment_method ?? "Cash"),
              Number.isNaN(paidAt.getTime()) ? new Date() : paidAt,
            );
          } catch (e: any) {
            console.warn(`[offline-sync] payment replay failed: ${e?.message ?? e}`);
          }
        }
      }

      // Queued staff status changes (Gap 4). Priority rules decide every
      // replay; stale/losing updates are dropped WITH a log line (spec rule 6).
      // Order/delivery status only — payment state is never touched here.
      if (offline_status_changes && offline_status_changes.length > 0) {
        for (const change of offline_status_changes) {
          try {
            const identifier = String(change?.orderId ?? "");
            const fallback = change?.fallbackIdentifier ? String(change.fallbackIdentifier) : null;
            const incoming = normalizeOrderStatus(change?.status);
            if (!identifier || !incoming) {
              console.warn("[offline-sync] status entry missing order/status — dropped.");
              continue;
            }
            let order = await this.resolveDrainOrder(tx, identifier);
            if (!order && fallback && fallback !== identifier) {
              order = await this.resolveDrainOrder(tx, fallback);
            }
            if (!order) {
              console.warn(`[offline-sync] status "${incoming}" for unknown order "${identifier}" — dropped.`);
              continue;
            }
            const verdict = decideStatusReplay(incoming, change?.updatedAt, order.status);
            if (verdict.action === "apply") {
              await tx.$executeRaw`
                UPDATE orders SET status = ${incoming} WHERE id = ${order.id}
              `;
              console.info(`[offline-sync] order ${order.orderNumber}: status → "${incoming}" (${verdict.reason}).`);
            } else {
              console.warn(`[offline-sync] order ${order.orderNumber}: status "${incoming}" dropped (${verdict.reason}).`);
            }
          } catch (e: any) {
            console.warn(`[offline-sync] status replay failed: ${e?.message ?? e}`);
          }
        }
      }
    });
  }
}

export const syncRepository = new SyncRepository();
