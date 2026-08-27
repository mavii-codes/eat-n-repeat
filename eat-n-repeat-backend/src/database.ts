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

export type DatabaseCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  status: "active" | "inactive" | "pending_verification";
  created_at: Date;
};

export type DatabaseStaffNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_order_id: string | null;
  is_read: boolean;
  created_at: Date;
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
export type DatabaseStockRequest = {
  id: string;
  staff_id: string;
  staff_name: string;
  ingredient_id: string;
  ingredient_name: string;
  current_quantity: number;
  unit: string;
  threshold: number;
  status: "Pending" | "Approved" | "Rejected";
  message: string | null;
  admin_note: string | null;
  created_at: Date;
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
    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(20),
      password_hash VARCHAR(255) NOT NULL,
      status ENUM('active', 'inactive', 'pending_verification') NOT NULL DEFAULT 'pending_verification',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await pool.query(`
      ALTER TABLE customers 
      MODIFY COLUMN status ENUM('active', 'inactive', 'pending_verification') NOT NULL DEFAULT 'pending_verification'
    `);
  } catch (err) {
    console.log("Could not alter customers status enum, it may already exist or table is empty");
  }

  try {
    await pool.query(`
      ALTER TABLE customers 
      ADD COLUMN avatar_url VARCHAR(255) DEFAULT NULL,
      ADD COLUMN notification_preferences JSON DEFAULT NULL
    `);
  } catch (err) {
    console.log("Could not add avatar_url/preferences to customers, columns might already exist");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_notifications (
      id VARCHAR(64) PRIMARY KEY,
      customer_id VARCHAR(64) NOT NULL,
      type ENUM('order', 'account', 'general') NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT notifications_customer_fk
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_favorites (
      customer_id VARCHAR(64) NOT NULL,
      menu_item_id VARCHAR(64) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (customer_id, menu_item_id),
      CONSTRAINT favorites_customer_fk
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_notifications (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      related_order_id VARCHAR(64),
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT staff_notifications_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id VARCHAR(64) PRIMARY KEY,
      customer_id VARCHAR(64) NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ev_tokens_customer_fk
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id VARCHAR(64) PRIMARY KEY,
      customer_id VARCHAR(64) NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT reset_tokens_customer_fk
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id VARCHAR(64) PRIMARY KEY,
      customer_id VARCHAR(64) NOT NULL,
      address_name VARCHAR(100) NOT NULL,
      full_address VARCHAR(255) NOT NULL,
      barangay VARCHAR(100) NOT NULL,
      municipality VARCHAR(100) NOT NULL,
      landmarks VARCHAR(255),
      delivery_notes VARCHAR(255),
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT addresses_customer_fk
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON DELETE CASCADE
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_requests (
      id VARCHAR(64) PRIMARY KEY,
      staff_id VARCHAR(64) NOT NULL,
      staff_name VARCHAR(120) NOT NULL,
      ingredient_id VARCHAR(64) NOT NULL,
      ingredient_name VARCHAR(160) NOT NULL,
      current_quantity DECIMAL(10, 2) NOT NULL,
      unit VARCHAR(30) NOT NULL,
      threshold DECIMAL(10, 2) NOT NULL,
      status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
      message TEXT,
      admin_note TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(64) PRIMARY KEY,
      order_number VARCHAR(50) NOT NULL,
      customer_id VARCHAR(64) DEFAULT NULL,
      customer_name VARCHAR(120) NOT NULL,
      phone VARCHAR(20),
      address TEXT,
      service_area_id VARCHAR(64),
      type ENUM('delivery', 'dine-in', 'pickup') NOT NULL DEFAULT 'delivery',
      items TEXT NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL,
      delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
      total DECIMAL(10,2) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      delivery_person VARCHAR(50) DEFAULT NULL,
      assigned_role VARCHAR(50) DEFAULT NULL,
      assigned_at TIMESTAMP NULL DEFAULT NULL,
      estimated_delivery_time VARCHAR(50) DEFAULT '15–25 min',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      delivered_at TIMESTAMP NULL,
      archived BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);

  try {
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN delivery_person VARCHAR(50) DEFAULT NULL,
      ADD COLUMN assigned_role VARCHAR(50) DEFAULT NULL,
      ADD COLUMN assigned_at TIMESTAMP NULL DEFAULT NULL,
      ADD COLUMN estimated_delivery_time VARCHAR(50) DEFAULT '15–25 min',
      ADD COLUMN cancelled_by VARCHAR(50) DEFAULT NULL,
      ADD COLUMN cancelled_at TIMESTAMP NULL DEFAULT NULL
    `);
  } catch (err) {
    // Columns may already exist
  }

  try {
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN customer_id VARCHAR(64) DEFAULT NULL
    `);
  } catch (err) {
    // Column may already exist
  }

  try {
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN pending_at TIMESTAMP NULL DEFAULT NULL,
      ADD COLUMN confirmed_at TIMESTAMP NULL DEFAULT NULL,
      ADD COLUMN preparing_at TIMESTAMP NULL DEFAULT NULL,
      ADD COLUMN ready_for_delivery_at TIMESTAMP NULL DEFAULT NULL,
      ADD COLUMN out_for_delivery_at TIMESTAMP NULL DEFAULT NULL
    `);
  } catch (err) {
    // Columns may already exist
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(64) PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      xendit_invoice_id VARCHAR(100),
      xendit_reference VARCHAR(100),
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      paid_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT payments_order_fk
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS addons (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    // Add sync_status for Local-to-Cloud synchronization
    await pool.query(`
      ALTER TABLE orders ADD COLUMN sync_status ENUM('synced', 'pending') NOT NULL DEFAULT 'pending';
    `);
    await pool.query(`
      ALTER TABLE payments ADD COLUMN sync_status ENUM('synced', 'pending') NOT NULL DEFAULT 'pending';
    `);
    await pool.query(`
      ALTER TABLE staff_notifications ADD COLUMN sync_status ENUM('synced', 'pending') NOT NULL DEFAULT 'pending';
    `);
    await pool.query(`
      ALTER TABLE customers ADD COLUMN sync_status ENUM('synced', 'pending') NOT NULL DEFAULT 'pending';
    `);
  } catch (err) {
    // Columns may already exist
  }

  const [addons] = await pool.query<mysql.RowDataPacket[]>("SELECT id FROM addons");
  if (addons.length === 0) {
    await pool.execute(
      `INSERT INTO addons (id, name, price, available) VALUES 
      ('addon-1', 'Extra Cheese', 20.00, TRUE),
      ('addon-2', 'Extra Sauce', 10.00, TRUE),
      ('addon-3', 'Extra Rice', 15.00, TRUE),
      ('addon-4', 'Extra Chicken', 40.00, TRUE),
      ('addon-5', 'Fried Egg', 15.00, TRUE)`
    );
  }

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
