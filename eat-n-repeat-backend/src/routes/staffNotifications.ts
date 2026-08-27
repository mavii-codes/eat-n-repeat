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
 * Helper to fetch the primary admin user ID for global notifications
 */
async function getAdminUserId(): Promise<string | null> {
  const pool = getPool();
  const [adminUsers] = await pool.execute<any[]>(
    "SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1"
  );
  return adminUsers.length > 0 ? adminUsers[0].id : null;
}

/**
 * Fetch notifications globally for the Staff Portal.
 * Uses the primary admin's notification stream since all staff receive identical notifications.
 */
router.get("/", async (req, res) => {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return res.json({ success: true, notifications: [] });
    }

    const pool = getPool();
    const [rows] = await pool.execute<any[]>(
      "SELECT * FROM staff_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      [adminId]
    );

    res.json({ success: true, notifications: rows });
  } catch (error) {
    console.error("Error fetching staff notifications:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * Mark a single notification as read.
 */
router.post("/:id/read", async (req, res) => {
  try {
    const notificationId = req.params.id;
    const adminId = await getAdminUserId();
    if (!adminId) {
      return res.status(400).json({ success: false, message: "No admin user found" });
    }

    const pool = getPool();
    await pool.execute(
      "UPDATE staff_notifications SET is_read = TRUE WHERE id = ? AND user_id = ?",
      [notificationId, adminId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking staff notification as read:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * Mark all notifications as read for the current stream.
 */
router.post("/read-all", async (req, res) => {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return res.status(400).json({ success: false, message: "No admin user found" });
    }

    const pool = getPool();
    await pool.execute(
      "UPDATE staff_notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE",
      [adminId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking all staff notifications as read:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
