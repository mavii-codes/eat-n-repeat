import { Router } from "express";
import { getPool } from "../database.js";

const router = Router();

// Endpoint for checking if the backend is online and can reach the cloud
router.get("/status", async (req, res) => {
  // In a real cloud environment, this endpoint might ping another cloud service.
  // For the local backend, it checks its own connectivity.
  // The frontend uses this to see if the LOCAL backend is reachable.
  return res.json({ success: true, isOffline: false });
});

// Endpoint on the CLOUD server to receive pushed data from LOCAL server
router.post("/push", async (req, res) => {
  const { orders, payments, customers, staff_notifications } = req.body;
  const pool = getPool();

  try {
    // Basic synchronization strategy: INSERT IGNORE or ON DUPLICATE KEY UPDATE
    // Since IDs are UUIDs, collisions only happen when syncing the same record twice.
    
    // Sync Customers
    if (customers && customers.length > 0) {
      for (const customer of customers) {
        await pool.execute(
          `INSERT INTO customers (id, name, email, phone, password_hash, status, created_at, avatar_url, notification_preferences)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           name=VALUES(name), phone=VALUES(phone), status=VALUES(status), avatar_url=VALUES(avatar_url)`,
          [customer.id, customer.name, customer.email, customer.phone, customer.password_hash, customer.status, customer.created_at, customer.avatar_url, JSON.stringify(customer.notification_preferences)]
        );
      }
    }

    // Sync Orders
    if (orders && orders.length > 0) {
      for (const order of orders) {
        await pool.execute(
          `INSERT INTO orders (id, order_number, customer_id, customer_name, phone, address, service_area_id, type, items, subtotal, delivery_fee, total, status, delivery_person, assigned_role, assigned_at, estimated_delivery_time, notes, created_at, delivered_at, archived)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           status=VALUES(status), delivery_person=VALUES(delivery_person), notes=VALUES(notes), archived=VALUES(archived)`,
          [order.id, order.order_number, order.customer_id, order.customer_name, order.phone, order.address, order.service_area_id, order.type, order.items, order.subtotal, order.delivery_fee, order.total, order.status, order.delivery_person, order.assigned_role, order.assigned_at, order.estimated_delivery_time, order.notes, order.created_at, order.delivered_at, order.archived]
        );
      }
    }

    // Sync Payments
    if (payments && payments.length > 0) {
      for (const payment of payments) {
        await pool.execute(
          `INSERT INTO payments (id, order_id, payment_method, xendit_invoice_id, xendit_reference, amount, status, paid_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status=VALUES(status), paid_at=VALUES(paid_at)`,
          [payment.id, payment.order_id, payment.payment_method, payment.xendit_invoice_id, payment.xendit_reference, payment.amount, payment.status, payment.paid_at, payment.created_at]
        );
      }
    }

    // Sync Notifications
    if (staff_notifications && staff_notifications.length > 0) {
      for (const notif of staff_notifications) {
        await pool.execute(
          `INSERT INTO staff_notifications (id, user_id, type, title, message, related_order_id, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE is_read=VALUES(is_read)`,
          [notif.id, notif.user_id, notif.type, notif.title, notif.message, notif.related_order_id, notif.is_read, notif.created_at]
        );
      }
    }

    return res.json({ success: true, message: "Sync successful" });
  } catch (err) {
    console.error("Sync Error:", err);
    return res.status(500).json({ success: false, error: "Sync failed" });
  }
});

// Endpoint to sync offline stock transactions and offline orders
router.post("/offline", async (req, res) => {
  const { offline_orders, offline_stock_transactions } = req.body;
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Sync Offline Orders (Insert only)
    if (offline_orders && offline_orders.length > 0) {
      for (const order of offline_orders) {
        await connection.execute(
          `INSERT IGNORE INTO orders (id, order_number, type, items, total, status, payment_method, archived, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [order.id, order.id, 'dine-in', order.items, order.total, order.status, 'Cash', 0, order.timestamp || new Date()]
        );
      }
    }

    // Sync Offline Stock Deductions idempotently
    if (offline_stock_transactions && offline_stock_transactions.length > 0) {
      for (const tx of offline_stock_transactions) {
        try {
          // Attempt to insert the transaction
          const [result] = await connection.execute(
            `INSERT INTO offline_stock_transactions (id, stock_item_id, quantity_deducted, order_id, staff_id, transaction_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [tx.id, tx.stockItemId, tx.quantityDeducted, tx.orderId, tx.staffId, tx.timestamp || new Date()]
          );
          
          // If insert succeeds, deduct the stock
          await connection.execute(
            `UPDATE stock_items SET quantity = GREATEST(0, quantity - ?) WHERE id = ?`,
            [tx.quantityDeducted, tx.stockItemId]
          );
        } catch (e: any) {
          // If ER_DUP_ENTRY, it means we already synced this transaction, so we ignore and don't double deduct.
          if (e.code !== 'ER_DUP_ENTRY') {
            throw e;
          }
        }
      }
    }

    await connection.commit();
    connection.release();
    return res.json({ success: true, message: "Offline Sync successful" });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error("Offline Sync Error:", err);
    return res.status(500).json({ success: false, error: "Offline Sync failed" });
  }
});

export const syncRouter = router;
