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

export default router;
