import bcrypt from "bcryptjs";
import mysql, { type Pool } from "mysql2/promise";
import { config } from "./config.js";

let pool: Pool;

export type DatabaseUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  password_hash: string;
  role: "admin" | "head_staff" | "staff";
  status: "active" | "inactive";
};

export type DatabaseStockCategory = { id: string; name: string };
export type DatabaseStockItem = {
  id: string;
  name: string;
  category_id: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
};

export async function initializeDatabase() {
  const connection = await mysql.createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database.name}\``);
  await connection.end();

  pool = mysql.createPool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
    waitForConnections: true,
    connectionLimit: 10,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      username VARCHAR(80) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'head_staff', 'staff') NOT NULL,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_categories (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_items (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      category_id VARCHAR(64) NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
      unit VARCHAR(30) NOT NULL,
      low_stock_threshold DECIMAL(10, 2) NOT NULL DEFAULT 5,
      CONSTRAINT stock_items_category_fk
        FOREIGN KEY (category_id) REFERENCES stock_categories(id)
        ON DELETE RESTRICT
    )
  `);

  const [users] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT id FROM users WHERE username = ?", ["admin"],
  );
  if (users.length === 0) {
    const passwordHash = await bcrypt.hash("admin123", 12);
    await pool.execute(
      `INSERT INTO users (id, name, username, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["admin-1", "Cafe Administrator", "admin", "owner@eatnrepeat.com", passwordHash, "admin"],
    );
  }
}

export async function findUserByIdentifier(identifier: string) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1",
    [identifier.toLowerCase(), identifier.toLowerCase()],
  );
  return (rows[0] as DatabaseUser | undefined) ?? undefined;
}

export async function findUserById(id: string) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM users WHERE id = ? LIMIT 1", [id],
  );
  return (rows[0] as DatabaseUser | undefined) ?? undefined;
}

export function getPool() {
  if (!pool) throw new Error("Database has not been initialized.");
  return pool;
}
