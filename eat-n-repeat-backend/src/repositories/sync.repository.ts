import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emitAdminEvent } from "@/lib/sse";
import { consumeFifo, lockItemForUpdate, round2 } from "@/services/stock/fifo-layers";
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
    originStaffId?: string | null,
    drainingUserId?: string | null,
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
    // Drawer attribution for offline cash: prefer the originating
    // cashier's still-open shift, else the draining operator's open shift.
    // GCash never touches the drawer. Duplicate-guarded by order id.
    if (safeMethod.trim().toLowerCase() === "cash") {
      try {
        await this.attributeReplayedCash(tx, order.id, order.orderNumber, Number(order.total) || 0, originStaffId ?? null, drainingUserId ?? null);
      } catch (e: any) {
        console.warn(`[offline-sync] drawer attribution for ${order.orderNumber} failed: ${e?.message ?? e}`);
      }
    }
    return "applied";
  }

  /**
   * Attribute a replayed cash collection to an open shift. Preference:
   * originating staff's open shift, then the draining operator's.
   * Closed/absent shifts => payment stays recorded, no drawer row.
   */
  private async attributeReplayedCash(
    tx: any,
    orderDbId: string,
    orderNumber: string,
    amount: number,
    originStaffId: string | null,
    drainingUserId?: string | null,
  ): Promise<void> {
    const dup = await tx.$queryRaw<any[]>`
      SELECT id FROM cash_transactions WHERE order_id = ${orderDbId} LIMIT 1
    `;
    if (dup.length > 0) return;
    const candidates = [originStaffId, drainingUserId].filter(Boolean) as string[];
    for (const staffId of candidates) {
      const openShift = await tx.$queryRaw<any[]>`
        SELECT id, staff_id FROM cash_shifts WHERE staff_id = ${staffId} AND status = 'open'
        ORDER BY start_time DESC LIMIT 1
      `;
      if (openShift.length === 0) continue;
      const staff = await tx.$queryRaw<any[]>`
        SELECT name FROM users WHERE id = ${staffId} LIMIT 1
      `;
      const staffName = staff.length > 0 ? staff[0].name : "Staff";
      await tx.$executeRaw`
        INSERT INTO cash_transactions (id, shift_id, order_id, type, amount, admin_id, admin_name, reason, timestamp)
        VALUES (${crypto.randomUUID()}, ${openShift[0].id}, ${orderDbId}, 'sale', ${amount}, ${staffId}, ${staffName}, ${`Offline replay ${orderNumber}`}, ${new Date()})
      `;
      await tx.$executeRaw`
        UPDATE cash_shifts SET expected_cash = expected_cash + ${amount} WHERE id = ${openShift[0].id}
      `;
      console.info(`[offline-sync] order ${orderNumber} cash ₱${amount} attributed to shift ${openShift[0].id}.`);
      return;
    }
    console.info(`[offline-sync] order ${orderNumber} has no open shift to attribute — payment recorded without drawer row.`);
  }

  async executeOfflineSync(
    offline_orders: any[],
    offline_stock_transactions: any[],
    offline_payments: any[] = [],
    offline_status_changes: any[] = [],
    offline_shifts: any[] = [],
    drainingUserId?: string | null,
  ) {
    // Admin SSE emits happen once after the batch transaction resolves; these
    // flags only record which kinds of writes the batch actually applied.
    let orderChanged = false;
    let paymentChanged = false;
    let stockChanged = false;

    await prisma.$transaction(async (tx) => {
      // Shift starts replay FIRST so later steps can attribute to them.
      // Starts are idempotent (existing id skipped) and never duplicate an
      // already-open shift for the same staff.
      const shiftStarts = (offline_shifts || []).filter((o: any) => o?.kind === "start");
      for (const op of shiftStarts) {
        try {
          const shiftId = String(op?.shiftId ?? "");
          const staffId = String(op?.staffId ?? "");
          if (!shiftId || !staffId) {
            console.warn("[offline-sync] shift start missing id/staff — dropped.");
            continue;
          }
          const staff = await tx.$queryRaw<any[]>`
            SELECT id, name, default_opening_float FROM users WHERE id = ${staffId} LIMIT 1
          `;
          if (staff.length === 0) {
            console.warn(`[offline-sync] shift start for unknown staff "${staffId}" — dropped.`);
            continue;
          }
          // Float always comes from the admin-configured staff profile —
          // client-supplied values are ignored, same as the online path.
          const float = Number(staff[0].default_opening_float);
          if (!Number.isFinite(float) || float <= 0) {
            console.warn(`[offline-sync] no opening float configured for staff "${staffId}" — start ${shiftId} dropped.`);
            continue;
          }
          const byId = await tx.$queryRaw<any[]>`
            SELECT id, status FROM cash_shifts WHERE id = ${shiftId} LIMIT 1
          `;
          if (byId.length > 0) {
            console.info(`[offline-sync] shift ${shiftId} already exists — start skipped.`);
            continue;
          }
          const openShift = await tx.$queryRaw<any[]>`
            SELECT id FROM cash_shifts WHERE staff_id = ${staffId} AND status = 'open'
            ORDER BY start_time DESC LIMIT 1
          `;
          if (openShift.length > 0) {
            console.warn(`[offline-sync] staff already has open shift ${openShift[0].id} — start ${shiftId} dropped.`);
            continue;
          }
          const startTime = op?.at ? new Date(op.at) : new Date();
          await tx.$executeRaw`
            INSERT INTO cash_shifts (id, staff_id, staff_name, starting_float, expected_cash, status, start_time)
            VALUES (${shiftId}, ${staffId}, ${staff[0].name}, ${float}, ${float}, 'open', ${Number.isNaN(startTime.getTime()) ? new Date() : startTime})
          `;
          console.info(`[offline-sync] shift ${shiftId} opened for ${staff[0].name}.`);
        } catch (e: any) {
          console.warn(`[offline-sync] shift start replay failed: ${e?.message ?? e}`);
        }
      }

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
          // Fulfillment type comes from the journal when present (POS
          // offline sales); older entries without it keep the legacy
          // dine-in default, so replay behavior is backward-compatible.
          const replayType =
            typeof order.type === "string" && order.type.trim() ? order.type.trim().slice(0, 20) : "dine-in";
          await tx.$executeRaw`
            INSERT IGNORE INTO orders (id, order_number, type, items, total, status, archived, created_at, address, notes)
            VALUES (${order.id}, ${order.id}, ${replayType}, ${items}, ${order.total}, ${order.status}, 0, ${createdAt}, ${order.address ?? null}, ${order.customerNotes ?? null})
          `;
          orderChanged = true;

          // Journaled cash sales replay as paid: mirror a PAID payment row
          // whenever the replayed order carries paid=true and no payment
          // exists yet — including a pre-existing row whose earlier replay
          // missed its mirror. The payment-existence check (not row age) is
          // what prevents double-collect.
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
            // Item-row lock FIRST (engine invariant), inside the already-open
            // outer transaction. The clamp means a journaled quantity larger
            // than on-hand can never drive stock negative.
            const stockItemId = String(txItem.stockItemId ?? "");
            const locked = await lockItemForUpdate(tx, stockItemId);

            if (!locked) {
              // Legacy behavior: journal the entry, deduct nothing.
              const requested = new Prisma.Decimal(txItem.quantityDeducted ?? 0);
              await tx.$executeRaw`
                INSERT INTO offline_stock_transactions (id, stock_item_id, quantity_deducted, order_id, staff_id, transaction_date)
                VALUES (${txItem.id}, ${txItem.stockItemId}, ${requested}, ${txItem.orderId}, ${txItem.staffId}, ${transactionDate})
              `;
              console.warn(`[offline-sync] stock item "${stockItemId}" not found — deduction journaled without stock change.`);
              continue;
            }

            const quantityBefore = new Prisma.Decimal(locked.quantity as any);
            const requested = new Prisma.Decimal(txItem.quantityDeducted ?? 0);
            const actual = Prisma.Decimal.min(requested, quantityBefore);

            // Journal the CLAMPED quantity, never the requested one, so the
            // durable offline record matches what actually left stock.
            await tx.$executeRaw`
              INSERT INTO offline_stock_transactions (id, stock_item_id, quantity_deducted, order_id, staff_id, transaction_date)
              VALUES (${txItem.id}, ${txItem.stockItemId}, ${actual}, ${txItem.orderId}, ${txItem.staffId}, ${transactionDate})
            `;

            // Consume before updating quantity: consumeFifo heals layer skew
            // against the item's current on-hand balance.
            const fifo = await consumeFifo(tx, { stockItemId, qty: actual });
            const quantityAfter = quantityBefore.minus(actual);

            await tx.stockItem.update({
              where: { id: stockItemId },
              data: { quantity: quantityAfter },
            });

            const unitCost =
              fifo.consumedUncostedQty.isZero() && !fifo.consumedCost.isZero() && !actual.isZero()
                ? round2(fifo.consumedCost.dividedBy(actual))
                : null;

            await tx.stockMovement.create({
              data: {
                id: `sm-${crypto.randomUUID()}`,
                stockItemId,
                itemName: locked.name,
                type: "SALE_DEDUCTION",
                quantityChange: actual.negated(),
                balanceBefore: quantityBefore,
                balanceAfter: quantityAfter,
                unitCost,
                totalCost: fifo.consumedCost.isZero() ? null : fifo.consumedCost,
                reason: "Offline order sync",
                reference: null,
                receivedAt: null,
                expiryDate: null,
                createdById: drainingUserId ?? "system-offline-sync",
                createdByName: "System (offline sync)",
              },
            });
            stockChanged = true;
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
            const paymentResult = await this.applyOfflinePayment(
              tx,
              identifier,
              String(pay?.method ?? pay?.payment_method ?? "Cash"),
              Number.isNaN(paidAt.getTime()) ? new Date() : paidAt,
              pay?.staffId ? String(pay.staffId) : null,
              drainingUserId ?? null,
            );
            if (paymentResult === "applied") paymentChanged = true;
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
              orderChanged = true;
              console.info(`[offline-sync] order ${order.orderNumber}: status → "${incoming}" (${verdict.reason}).`);
            } else {
              console.warn(`[offline-sync] order ${order.orderNumber}: status "${incoming}" dropped (${verdict.reason}).`);
            }
          } catch (e: any) {
            console.warn(`[offline-sync] status replay failed: ${e?.message ?? e}`);
          }
        }
      }

      // Shift closes replay LAST so expectedCash already includes every
      // replayed sale above. Owner-only, open-only, computed server-side.
      const shiftCloses = (offline_shifts || []).filter((o: any) => o?.kind === "close");
      for (const op of shiftCloses) {
        try {
          const shiftId = String(op?.shiftId ?? "");
          if (!shiftId) {
            console.warn("[offline-sync] shift close without id — dropped.");
            continue;
          }
          const rows = await tx.$queryRaw<any[]>`
            SELECT id, staff_id, status, expected_cash FROM cash_shifts WHERE id = ${shiftId} LIMIT 1
          `;
          if (rows.length === 0) {
            console.warn(`[offline-sync] shift close for unknown shift "${shiftId}" — dropped.`);
            continue;
          }
          const shift = rows[0];
          if (shift.status !== "open") {
            console.info(`[offline-sync] shift ${shiftId} already ${shift.status} — close skipped.`);
            continue;
          }
          if (op?.staffId && String(op.staffId) !== String(shift.staff_id)) {
            console.warn(`[offline-sync] shift ${shiftId} close by non-owner — dropped.`);
            continue;
          }
          const expectedCash = Number(shift.expected_cash) || 0;
          const actualCash = Number(op?.actualCash);
          if (!Number.isFinite(actualCash) || actualCash < 0) {
            console.warn(`[offline-sync] shift ${shiftId} close with invalid cash — dropped.`);
            continue;
          }
          const difference = actualCash - expectedCash;
          const status = difference < -0.01 ? "short" : difference > 0.01 ? "over" : "matched";
          const notes =
            typeof op?.notes === "string" && op.notes.trim() ? op.notes.trim().slice(0, 2000) : null;
          const endTime = op?.at ? new Date(op.at) : new Date();
          await tx.$executeRaw`
            UPDATE cash_shifts
            SET end_time = ${Number.isNaN(endTime.getTime()) ? new Date() : endTime},
              actual_cash = ${actualCash}, difference = ${difference}, status = ${status},
              notes = ${notes}
            WHERE id = ${shiftId}
          `;
          console.info(`[offline-sync] shift ${shiftId} closed (${status}, variance ${difference}).`);
        } catch (e: any) {
          console.warn(`[offline-sync] shift close replay failed: ${e?.message ?? e}`);
        }
      }
    });

    // Emit once per replayed batch, only after the transaction committed.
    try {
      if (orderChanged) {
        emitAdminEvent({ type: "ORDER_UPDATED", at: new Date().toISOString() });
      }
    } catch {
      /* event must never break the write */
    }
    try {
      if (paymentChanged) {
        emitAdminEvent({ type: "PAYMENT_UPDATED", at: new Date().toISOString() });
      }
    } catch {
      /* event must never break the write */
    }
    try {
      if (stockChanged) {
        emitAdminEvent({ type: "STOCK_UPDATED", at: new Date().toISOString() });
      }
    } catch {
      /* event must never break the write */
    }
  }
}

export const syncRepository = new SyncRepository();
