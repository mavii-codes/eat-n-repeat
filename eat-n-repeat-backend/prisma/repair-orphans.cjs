/**
 * repair-orphans.cjs — one-time, idempotent pre-push cleanup for LOCAL MySQL.
 *
 * Problem: guest checkout writes orders with synthetic customer_id values
 * (e.g. "cust-<timestamp>-<rand>") that never get a matching row in the
 * `customers` table (only registration inserts customers). When
 * `prisma db push` adds the orders.customer_id -> customers.id foreign key,
 * MySQL validates existing rows and aborts on those orphans:
 *   "Cannot add or update a child row: a foreign key constraint fails..."
 *
 * Fix (data-preserving, matches the relation's own ON DELETE SET NULL
 * semantics in schema.prisma): set ONLY orphaned customer_id values to NULL.
 * Valid customer/order relationships are untouched by construction
 * (NOT IN subquery). Orders themselves are never deleted.
 *
 * Usage (from eat-n-repeat-backend/):
 *   node prisma/repair-orphans.cjs            # repair
 *   node prisma/repair-orphans.cjs --dry-run  # report only, writes nothing
 *
 * Exit codes: 0 = clean (or nothing to do), 1 = orphans remain / unexpected error.
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

const DRY_RUN = process.argv.includes('--dry-run');

async function tableExists(pool, name) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [name]
  );
  return Number(rows[0].n) > 0;
}

async function countOrphans(pool) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM orders
      WHERE customer_id IS NOT NULL
        AND customer_id NOT IN (SELECT id FROM customers)`
  );
  return Number(rows[0].n);
}

async function sampleOrphans(pool) {
  const [rows] = await pool.query(
    `SELECT id, order_number, customer_id FROM orders
      WHERE customer_id IS NOT NULL
        AND customer_id NOT IN (SELECT id FROM customers)
      LIMIT 10`
  );
  return rows;
}

async function run() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  try {
    if (!(await tableExists(pool, 'orders')) || !(await tableExists(pool, 'customers'))) {
      console.log('[repair-orphans] orders/customers table missing (fresh database) — nothing to repair.');
      return 0;
    }

    const before = await countOrphans(pool);
    console.log(`[repair-orphans] orphaned orders.customer_id rows: ${before}`);
    if (before > 0) {
      const sample = await sampleOrphans(pool);
      for (const row of sample) {
        console.log(
          `[repair-orphans] orphan sample: order id=${row.id} number=${row.order_number} customer_id=${row.customer_id}`
        );
      }
    }

    if (DRY_RUN) {
      console.log('[repair-orphans] dry-run mode: no writes performed.');
      return 0;
    }

    if (before === 0) {
      console.log('[repair-orphans] no orphans — nothing to do.');
      return 0;
    }

    const [result] = await pool.query(
      `UPDATE orders SET customer_id = NULL
        WHERE customer_id IS NOT NULL
          AND customer_id NOT IN (SELECT id FROM customers)`
    );
    console.log(`[repair-orphans] nulled customer_id on ${result.affectedRows} order(s).`);

    const after = await countOrphans(pool);
    if (after !== 0) {
      console.error(`[repair-orphans] FAILED: ${after} orphaned row(s) remain.`);
      return 1;
    }
    console.log('[repair-orphans] verified: 0 orphans remain.');
    return 0;
  } catch (err) {
    console.error('[repair-orphans] ERROR:', err.message || err);
    return 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

run().then((code) => process.exit(code));
