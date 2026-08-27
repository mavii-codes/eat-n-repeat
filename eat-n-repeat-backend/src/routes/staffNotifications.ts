import { Router } from "express";
import crypto from "crypto";
import { getPool } from "../database.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/require-auth.js";

const router = Router();

/**
 * Helper to notify all staff members.
 */
export async function notifyAllStaff(
  type: string,
  title: string,
  message: string,
  relatedOrderId?: string
) {
  try {
    const pool = getPool();
    // Fetch all active users with roles that should receive notifications
    const [staffUsers] = await pool.execute<any[]>(
      "SELECT id FROM users WHERE role IN ('staff', 'head_staff', 'admin') AND status = 'active'"
    );

    if (!staffUsers || staffUsers.length === 0) return;

    // Create a notification for each staff member
    for (const user of staffUsers) {
      const notifId = crypto.randomUUID();
      await pool.execute(
        `INSERT INTO staff_notifications (id, user_id, type, title, message, related_order_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [notifId, user.id, type, title, message, relatedOrderId || null]
      );
    }
  } catch (error) {
    console.error("Error sending staff notifications:", error);
  }
}

/**
 * Fetch notifications globally for the Staff Portal.
 * Uses a generic approach since all staff receive identical notifications.
 */
router.get("/", async (req, res) => {
  try {
    const pool = getPool();
    // Fetch unique notifications based on title and message (since each user gets a copy)
    const [rows] = await pool.execute<any[]>(
      `SELECT MIN(id) as id, type, title, message, related_order_id, MIN(is_read) as is_read, MAX(created_at) as created_at
       FROM staff_notifications
       GROUP BY type, title, message, related_order_id
       ORDER BY MAX(created_at) DESC LIMIT 50`
    );

    res.json({ success: true, notifications: rows });
  } catch (error) {
    console.error("Error fetching staff notifications:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * Mark a single notification as read across all copies.
 */
router.post("/:id/read", async (req, res) => {
  try {
    const notificationId = req.params.id;
    const pool = getPool();
    
    // First find the notification to match its title/message
    const [notifs] = await pool.execute<any[]>(
      "SELECT title, message FROM staff_notifications WHERE id = ?",
      [notificationId]
    );

    if (notifs.length > 0) {
      await pool.execute(
        "UPDATE staff_notifications SET is_read = TRUE WHERE title = ? AND message = ?",
        [notifs[0].title, notifs[0].message]
      );
    } else {
      await pool.execute("UPDATE staff_notifications SET is_read = TRUE WHERE id = ?", [notificationId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking staff notification as read:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * Mark all notifications as read globally.
 */
router.post("/read-all", async (req, res) => {
  try {
    const pool = getPool();
    await pool.execute("UPDATE staff_notifications SET is_read = TRUE WHERE is_read = FALSE");
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking all staff notifications as read:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
