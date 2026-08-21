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
 * Fetch notifications for the currently logged in staff member.
 */
router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const pool = getPool();
    const [rows] = await pool.execute<any[]>(
      "SELECT * FROM staff_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      [userId]
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
router.post("/:id/read", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.auth?.userId;
    const notificationId = req.params.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const pool = getPool();
    await pool.execute(
      "UPDATE staff_notifications SET is_read = TRUE WHERE id = ? AND user_id = ?",
      [notificationId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking staff notification as read:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * Mark all notifications as read for the current user.
 */
router.post("/read-all", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const pool = getPool();
    await pool.execute(
      "UPDATE staff_notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE",
      [userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking all staff notifications as read:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
