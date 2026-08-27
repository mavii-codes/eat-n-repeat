const mysql = require('mysql2/promise');
require('dotenv').config({path: './.env'});

async function run() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  try {
    await pool.query("ALTER TABLE cash_transactions MODIFY COLUMN type ENUM('sale', 'refund', 'float_adjustment', 'float_addition') NOT NULL DEFAULT 'sale'");
    await pool.query("ALTER TABLE cash_transactions ADD COLUMN admin_id VARCHAR(64) DEFAULT NULL, ADD COLUMN admin_name VARCHAR(120) DEFAULT NULL, ADD COLUMN reason VARCHAR(255) DEFAULT NULL");
    console.log('success');
  } catch(e) {
    console.error(e);
  }
  process.exit();
}

run();
