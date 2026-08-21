import { Router } from "express";
import crypto from "crypto";
import { getPool } from "../database.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/require-auth.js";
import { z } from "zod";

const router = Router();

/**
 * GET /api/addons
 * Public endpoint to fetch all available addons (or all addons for admin).
 */
router.get("/", async (req, res) => {
  try {
    const isAdmin = req.query.admin === 'true';
    const pool = getPool();
    
    let query = "SELECT * FROM addons ORDER BY created_at ASC";
    if (!isAdmin) {
      query = "SELECT * FROM addons WHERE available = TRUE ORDER BY created_at ASC";
    }

    const [rows] = await pool.execute<any[]>(query);
    
    const addons = rows.map(row => ({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      available: Boolean(row.available),
      createdAt: row.created_at
    }));

    res.json({ success: true, addons });
  } catch (error) {
    console.error("Error fetching addons:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

const addonSchema = z.object({
  name: z.string().trim().min(1),
  price: z.coerce.number().min(0),
  available: z.boolean().default(true),
});

/**
 * POST /api/addons
 * Admin only: Create a new addon
 */
router.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(403).json({ success: false, message: "Forbidden" });
    const pool = getPool();
    const [userRows] = await pool.execute<any[]>("SELECT role FROM users WHERE id = ?", [userId]);
    
    if (userRows.length === 0 || (userRows[0].role !== 'admin' && userRows[0].role !== 'head_staff')) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const parsed = addonSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid addon data" });
    }

    const { name, price, available } = parsed.data;
    const id = `addon-${crypto.randomUUID()}`;

    await pool.execute(
      "INSERT INTO addons (id, name, price, available) VALUES (?, ?, ?, ?)",
      [id, name, price, available]
    );

    res.json({ success: true, addon: { id, name, price, available } });
  } catch (error) {
    console.error("Error creating addon:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * PUT /api/addons/:id
 * Admin only: Update an addon
 */
router.put("/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(403).json({ success: false, message: "Forbidden" });
    const pool = getPool();
    const [userRows] = await pool.execute<any[]>("SELECT role FROM users WHERE id = ?", [userId]);
    
    if (userRows.length === 0 || (userRows[0].role !== 'admin' && userRows[0].role !== 'head_staff')) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const parsed = addonSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid addon data" });
    }

    const { name, price, available } = parsed.data;
    const { id } = req.params;

    await pool.execute(
      "UPDATE addons SET name = ?, price = ?, available = ? WHERE id = ?",
      [name, price, available, id]
    );

    res.json({ success: true, addon: { id, name, price, available } });
  } catch (error) {
    console.error("Error updating addon:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * DELETE /api/addons/:id
 * Admin only: Delete an addon
 */
router.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(403).json({ success: false, message: "Forbidden" });
    const pool = getPool();
    const [userRows] = await pool.execute<any[]>("SELECT role FROM users WHERE id = ?", [userId]);
    
    if (userRows.length === 0 || (userRows[0].role !== 'admin' && userRows[0].role !== 'head_staff')) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { id } = req.params;

    await pool.execute("DELETE FROM addons WHERE id = ?", [id]);

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting addon:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
