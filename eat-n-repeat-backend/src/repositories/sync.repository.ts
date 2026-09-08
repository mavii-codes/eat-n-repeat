import { prisma } from "@/lib/prisma";

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

  async executeOfflineSync(
    offline_orders: any[],
    offline_stock_transactions: any[],
  ) {
    await prisma.$transaction(async (tx) => {
      // Sync Offline Orders (INSERT IGNORE)
      if (offline_orders && offline_orders.length > 0) {
        for (const order of offline_orders) {
          const items =
            order.items !== undefined && order.items !== null && typeof order.items !== "string"
              ? JSON.stringify(order.items)
              : order.items;

          const createdAt = order.timestamp || new Date();

          await tx.$executeRaw`
            INSERT IGNORE INTO orders (id, order_number, type, items, total, status, payment_method, archived, created_at)
            VALUES (${order.id}, ${order.id}, 'dine-in', ${items}, ${order.total}, ${order.status}, 'Cash', 0, ${createdAt})
          `;
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
    });
  }
}

export const syncRepository = new SyncRepository();
