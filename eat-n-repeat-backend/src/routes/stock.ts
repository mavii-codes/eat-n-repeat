import { randomUUID } from "node:crypto";
import { Router } from "express";
import mysql from "mysql2/promise";
import { z } from "zod";
import {
  getPool,
  type DatabaseStockCategory,
  type DatabaseStockItem,
} from "../database.js";
import { requireAuth } from "../middleware/require-auth.js";

const router = Router();
router.use(requireAuth);

const categorySchema = z.object({ name: z.string().trim().min(1).max(120) });
const itemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  categoryId: z.string().trim().min(1),
  quantity: z.coerce.number().min(0),
  unit: z.string().trim().min(1).max(30),
  lowStockThreshold: z.coerce.number().min(0),
});

const categoryResponse = (category: DatabaseStockCategory) => ({
  id: category.id,
  name: category.name,
});

const itemResponse = (item: DatabaseStockItem) => ({
  id: item.id,
  name: item.name,
  categoryId: item.category_id,
  quantity: Number(item.quantity),
  unit: item.unit,
  lowStockThreshold: Number(item.low_stock_threshold),
});

router.get("/categories", async (_req, res) => {
  const [rows] = await getPool().query<mysql.RowDataPacket[]>(
    "SELECT * FROM stock_categories ORDER BY name",
  );
  res.json({ categories: rows.map((row) => categoryResponse(row as DatabaseStockCategory)) });
});

router.post("/categories", async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "A category name is required." });

  const category = { id: `sc-${randomUUID()}`, name: parsed.data.name };
  try {
    await getPool().execute("INSERT INTO stock_categories (id, name) VALUES (?, ?)", [category.id, category.name]);
    return res.status(201).json({ category });
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "That stock category already exists." });
    }
    throw error;
  }
});

router.put("/categories/:id", async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "A category name is required." });
  const [result] = await getPool().execute<mysql.ResultSetHeader>(
    "UPDATE stock_categories SET name = ? WHERE id = ?", [parsed.data.name, req.params.id],
  );
  if (result.affectedRows === 0) return res.status(404).json({ message: "Category not found." });
  return res.json({ category: { id: req.params.id, name: parsed.data.name } });
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const [result] = await getPool().execute<mysql.ResultSetHeader>(
      "DELETE FROM stock_categories WHERE id = ?", [req.params.id],
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: "Category not found." });
    return res.status(204).send();
  } catch (error) {
    if ((error as { code?: string }).code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({ message: "Remove this category's stock items first." });
    }
    throw error;
  }
});

router.get("/items", async (_req, res) => {
  const [rows] = await getPool().query<mysql.RowDataPacket[]>("SELECT * FROM stock_items ORDER BY name");
  res.json({ items: rows.map((row) => itemResponse(row as DatabaseStockItem)) });
});

router.post("/items", async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Stock item details are invalid." });
  const item = { id: `st-${randomUUID()}`, ...parsed.data };
  try {
    await getPool().execute(
      `INSERT INTO stock_items (id, name, category_id, quantity, unit, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [item.id, item.name, item.categoryId, item.quantity, item.unit, item.lowStockThreshold],
    );
    return res.status(201).json({ item });
  } catch (error) {
    if ((error as { code?: string }).code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ message: "The selected stock category does not exist." });
    }
    throw error;
  }
});

router.put("/items/:id", async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Stock item details are invalid." });
  const item = parsed.data;
  const [result] = await getPool().execute<mysql.ResultSetHeader>(
    `UPDATE stock_items
     SET name = ?, category_id = ?, quantity = ?, unit = ?, low_stock_threshold = ?
     WHERE id = ?`,
    [item.name, item.categoryId, item.quantity, item.unit, item.lowStockThreshold, req.params.id],
  );
  if (result.affectedRows === 0) return res.status(404).json({ message: "Stock item not found." });
  return res.json({ item: { id: req.params.id, ...item } });
});

router.delete("/items/:id", async (req, res) => {
  const [result] = await getPool().execute<mysql.ResultSetHeader>(
    "DELETE FROM stock_items WHERE id = ?", [req.params.id],
  );
  if (result.affectedRows === 0) return res.status(404).json({ message: "Stock item not found." });
  return res.status(204).send();
});

/* ── Stock Requests Endpoints ── */

const stockRequestInputSchema = z.object({
  ingredientId: z.string().trim().min(1),
  ingredientName: z.string().trim().min(1),
  currentQuantity: z.coerce.number(),
  unit: z.string().trim().min(1),
  threshold: z.coerce.number(),
  message: z.string().optional(),
  staffId: z.string().optional(),
  staffName: z.string().optional(),
});

const stockRequestStatusSchema = z.object({
  status: z.enum(["Pending", "Approved", "Rejected"]),
  adminNote: z.string().optional(),
});

const requestResponse = (row: any) => ({
  id: row.id,
  staffId: row.staff_id,
  staffName: row.staff_name,
  ingredientId: row.ingredient_id,
  ingredientName: row.ingredient_name,
  currentQuantity: Number(row.current_quantity),
  unit: row.unit,
  threshold: Number(row.threshold),
  status: row.status,
  message: row.message || "",
  adminNote: row.admin_note || "",
  createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
});

router.get("/requests", async (_req, res) => {
  const [rows] = await getPool().query<mysql.RowDataPacket[]>(
    "SELECT * FROM stock_requests ORDER BY created_at DESC",
  );
  return res.json({ requests: rows.map(requestResponse) });
});

router.post("/requests", async (req, res) => {
  const parsed = stockRequestInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid restock request details." });
  }

  const { ingredientId, ingredientName, currentQuantity, unit, threshold, message } = parsed.data;
  const staffId = (req as any).user?.id || parsed.data.staffId || "sf-1";
  const staffName = (req as any).user?.name || parsed.data.staffName || "Staff";

  // Prevent duplicate requests if a pending request already exists for this ingredient
  const [existing] = await getPool().query<mysql.RowDataPacket[]>(
    "SELECT id FROM stock_requests WHERE ingredient_id = ? AND status = 'Pending' LIMIT 1",
    [ingredientId]
  );
  if (existing.length > 0) {
    return res.status(409).json({ message: "A restock request for this item is already pending Admin review." });
  }

  const id = `sr-${randomUUID()}`;
  const createdAt = new Date();

  await getPool().execute(
    `INSERT INTO stock_requests 
     (id, staff_id, staff_name, ingredient_id, ingredient_name, current_quantity, unit, threshold, status, message, admin_note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, NULL, ?)`,
    [id, staffId, staffName, ingredientId, ingredientName, currentQuantity, unit, threshold, message || null, createdAt]
  );

  return res.status(201).json({
    request: {
      id,
      staffId,
      staffName,
      ingredientId,
      ingredientName,
      currentQuantity,
      unit,
      threshold,
      status: "Pending",
      message: message || "",
      adminNote: "",
      createdAt: createdAt.toISOString(),
    },
  });
});

router.patch("/requests/:id/status", async (req, res) => {
  const parsed = stockRequestStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request status." });
  }

  const { status, adminNote } = parsed.data;

  const [result] = await getPool().execute<mysql.ResultSetHeader>(
    "UPDATE stock_requests SET status = ?, admin_note = ? WHERE id = ?",
    [status, adminNote || null, req.params.id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ message: "Stock request not found." });
  }

  const [rows] = await getPool().execute<mysql.RowDataPacket[]>(
    "SELECT * FROM stock_requests WHERE id = ? LIMIT 1",
    [req.params.id]
  );

  return res.json({ request: requestResponse(rows[0]) });
});

export default router;
