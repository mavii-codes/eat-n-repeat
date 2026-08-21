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

export const syncRouter = router;
