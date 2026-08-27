import express from "express";
import { getPool } from "../database.js";
import { requireAuth as authenticate } from "../middleware/require-auth.js";
import crypto from "crypto";
import mysql from "mysql2/promise";

const router = express.Router();

// Get current active shift for authenticated user
router.get("/shift/current", authenticate, async (req: any, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const [shifts] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM cash_shifts WHERE staff_id = ? AND status = 'open' ORDER BY start_time DESC LIMIT 1",
      [userId]
    );

    if (shifts.length > 0) {
      res.json({ success: true, shift: shifts[0] });
    } else {
      res.json({ success: true, shift: null });
    }
  } catch (error) {
    console.error("Error fetching current shift:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Start a new shift
router.post("/shift/start", authenticate, async (req: any, res) => {
  try {
    const { startingFloat } = req.body;
    if (typeof startingFloat !== 'number' || startingFloat < 0) {
      return res.status(400).json({ success: false, message: "Invalid starting float" });
    }

    const pool = getPool();
    const userId = req.user.id;
    
    // Check if there's already an open shift
    const [openShifts] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM cash_shifts WHERE staff_id = ? AND status = 'open'",
      [userId]
    );

    if (openShifts.length > 0) {
      return res.status(400).json({ success: false, message: "You already have an open shift." });
    }

    // Get staff name
    const [users] = await pool.execute<mysql.RowDataPacket[]>("SELECT name FROM users WHERE id = ?", [userId]);
    const staffName = users[0]?.name || "Staff";

    const shiftId = `shift-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    
    await pool.execute(
      `INSERT INTO cash_shifts (id, staff_id, staff_name, starting_float, expected_cash, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [shiftId, userId, staffName, startingFloat, startingFloat]
    );

    const [newShift] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM cash_shifts WHERE id = ?", [shiftId]
    );

    res.json({ success: true, shift: newShift[0] });
  } catch (error) {
    console.error("Error starting shift:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// End a shift
router.post("/shift/end", authenticate, async (req: any, res) => {
  try {
    const { shiftId, actualCash } = req.body;
    if (typeof actualCash !== 'number' || actualCash < 0) {
      return res.status(400).json({ success: false, message: "Invalid actual cash amount" });
    }

    const pool = getPool();
    const userId = req.user.id;

    // Fetch shift
    const [shifts] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM cash_shifts WHERE id = ? AND staff_id = ? AND status = 'open'",
      [shiftId, userId]
    );

    if (shifts.length === 0) {
      return res.status(404).json({ success: false, message: "Open shift not found or already closed." });
    }

    const shift = shifts[0];
    const expectedCash = parseFloat(shift.expected_cash);
    const difference = actualCash - expectedCash;
    
    let status = 'matched';
    if (difference < -0.01) status = 'short';
    if (difference > 0.01) status = 'over';

    await pool.execute(
      `UPDATE cash_shifts 
       SET end_time = CURRENT_TIMESTAMP, actual_cash = ?, difference = ?, status = ? 
       WHERE id = ?`,
      [actualCash, difference, status, shiftId]
    );

    const [updatedShift] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM cash_shifts WHERE id = ?", [shiftId]
    );

    res.json({ success: true, shift: updatedShift[0] });
  } catch (error) {
    console.error("Error ending shift:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Admin: Get all shifts
router.get("/shifts", authenticate, async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const pool = getPool();
    const [shifts] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM cash_shifts ORDER BY start_time DESC"
    );

    res.json({ success: true, shifts });
  } catch (error) {
    console.error("Error fetching shifts:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Admin: Get shift details
router.get("/shifts/:id", authenticate, async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const pool = getPool();
    const [shifts] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM cash_shifts WHERE id = ?",
      [req.params.id]
    );

    if (shifts.length === 0) {
      return res.status(404).json({ success: false, message: "Shift not found" });
    }

    const [transactions] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM cash_transactions WHERE shift_id = ? ORDER BY timestamp DESC",
      [req.params.id]
    );

    res.json({ success: true, shift: shifts[0], transactions });
  } catch (error) {
    console.error("Error fetching shift details:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
