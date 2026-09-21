/**
 * repair-orphans.cjs — one-time, idempotent pre-push cleanup for LOCAL MySQL.
 *
 * Problem: legacy rows were written while foreign-key constraints did not
 * exist in the database (guest checkouts, deleted parents, pre-constraint
 * imports). When `prisma db push` adds those FKs, MySQL validates existing
 * rows and aborts on orphans, e.g.:
 *   "Cannot add or update a child row: a foreign key constraint fails..."
 *
 * Repair rules (mirror the schema's own relation behavior — nothing invented):
 * - Nullable FK (orders.customer_id, implicit ON DELETE SET NULL):
 *   set ONLY orphaned values to NULL. Orders are never deleted.
 * - Required FK with ON DELETE CASCADE (payments, customer_notifications,
 *   customer_favorites, customer_addresses, email/password tokens,
 *   staff_notifications): DELETE ONLY orphan rows. This reproduces exactly
 *   what CASCADE would have done had the constraint existed when the parent
 *   vanished. Valid rows (parent still present) are untouched by construction.
 * - Required FK with ON DELETE Restrict (stock_items.category_id,
 *   cash_transactions.shift_id): NEVER auto-fixed — abort loudly instead,
 *   because deleting inventory/cash records would destroy real data.
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

// Nullable FK -> set orphans to NULL.
const NULL_REPAIRS = [
  { table: 'orders', column: 'customer_id', parent: 'customers', parentCol: 'id' },
];

// Required FK + CASCADE -> delete orphan rows (CASCADE-equivalent).
const DELETE_REPAIRS = [
  { table: 'payments', column: 'order_id', parent: 'orders', parentCol: 'id' },
  { table: 'customer_notifications', column: 'customer_id', parent: 'customers', parentCol: 'id' },
  { table: 'customer_favorites', column: 'customer_id', parent: 'customers', parentCol: 'id' },
  { table: 'customer_addresses', column: 'customer_id', parent: 'customers', parentCol: 'id' },
  { table: 'email_verification_tokens', column: 'customer_id', parent: 'customers', parentCol: 'id' },
  { table: 'password_reset_tokens', column: 'customer_id', parent: 'customers', parentCol: 'id' },
  { table: 'staff_notifications', column: 'user_id', parent: 'users', parentCol: 'id' },
];

// Required FK + Restrict -> never auto-fix; abort loudly instead.
const RESTRICT_CHECKS = [
  { table: 'stock_items', column: 'category_id', parent: 'stock_categories', parentCol: 'id' },
  { table: 'cash_transactions', column: 'shift_id', parent: 'cash_shifts', parentCol: 'id' },
];

async function tableExists(pool, name) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [name]
  );
  return Number(rows[0].n) > 0;
}

async function countOrphans(pool, table, column, parent, parentCol) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM \`${table}\`
      WHERE \`${column}\` IS NOT NULL
        AND \`${column}\` NOT IN (SELECT \`${parentCol}\` FROM \`${parent}\`)`
  );
  return Number(rows[0].n);
}

async function sampleOrphans(pool, table, column, parent, parentCol) {
  // NOTE: selects only the FK column — some tables (e.g. customer_favorites
  // with compound PK) have no single `id` column.
  const [rows] = await pool.query(
    `SELECT \`${column}\` AS fk FROM \`${table}\`
      WHERE \`${column}\` IS NOT NULL
        AND \`${column}\` NOT IN (SELECT \`${parentCol}\` FROM \`${parent}\`)
      LIMIT 10`
  );
  return rows;
}

async function run() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  try {
    let repairedTotal = 0;

    // 1) Nullable FKs -> NULL the orphans.
    for (const r of NULL_REPAIRS) {
      if (!(await tableExists(pool, r.table)) || !(await tableExists(pool, r.parent))) {
        console.log(`[repair-orphans] Checking ${r.table}.${r.column}... skipped (table missing, fresh database).`);
        continue;
      }
      console.log(`[repair-orphans] Checking ${r.table}.${r.column}...`);
      const before = await countOrphans(pool, r.table, r.column, r.parent, r.parentCol);
      console.log(`[repair-orphans] Found ${before} orphaned ${r.table} ${r.column} reference(s).`);
      for (const row of await sampleOrphans(pool, r.table, r.column, r.parent, r.parentCol)) {
        console.log(`[repair-orphans] orphan sample: ${r.table} ${r.column}=${row.fk}`);
      }
      if (!DRY_RUN && before > 0) {
        const [result] = await pool.query(
          `UPDATE \`${r.table}\` SET \`${r.column}\` = NULL
            WHERE \`${r.column}\` IS NOT NULL
              AND \`${r.column}\` NOT IN (SELECT \`${r.parentCol}\` FROM \`${r.parent}\`)`
        );
        console.log(`[repair-orphans] Set ${result.affectedRows} orphaned ${r.column} value(s) to NULL.`);
        repairedTotal += result.affectedRows;
      }
    }

    // 2) CASCADE FKs -> delete orphan rows (CASCADE-equivalent).
    for (const r of DELETE_REPAIRS) {
      if (!(await tableExists(pool, r.table)) || !(await tableExists(pool, r.parent))) {
        console.log(`[repair-orphans] Checking ${r.table}.${r.column}... skipped (table missing, fresh database).`);
        continue;
      }
      console.log(`[repair-orphans] Checking ${r.table}.${r.column}...`);
      const before = await countOrphans(pool, r.table, r.column, r.parent, r.parentCol);
      console.log(`[repair-orphans] Found ${before} orphaned ${r.table} reference(s).`);
      for (const row of await sampleOrphans(pool, r.table, r.column, r.parent, r.parentCol)) {
        console.log(`[repair-orphans] orphan sample: ${r.table} ${r.column}=${row.fk}`);
      }
      if (!DRY_RUN && before > 0) {
        const [result] = await pool.query(
          `DELETE FROM \`${r.table}\`
            WHERE \`${r.column}\` IS NOT NULL
              AND \`${r.column}\` NOT IN (SELECT \`${r.parentCol}\` FROM \`${r.parent}\`)`
        );
        console.log(`[repair-orphans] Repaired ${result.affectedRows} orphaned ${r.table} reference(s).`);
        repairedTotal += result.affectedRows;
      }
    }

    // 3) Restrict FKs -> report only, abort loudly (never auto-delete).
    for (const r of RESTRICT_CHECKS) {
      if (!(await tableExists(pool, r.table)) || !(await tableExists(pool, r.parent))) {
        console.log(`[repair-orphans] Checking ${r.table}.${r.column}... skipped (table missing, fresh database).`);
        continue;
      }
      const n = await countOrphans(pool, r.table, r.column, r.parent, r.parentCol);
      if (n > 0) {
        console.error(
          `[repair-orphans] BLOCKED: ${n} orphaned ${r.table}.${r.column} row(s) reference missing ${r.parent} ` +
          `and the relation is Restrict — refusing to auto-fix (would destroy real data). ` +
          `Resolve manually, then re-run bootstrap.`
        );
        return 1;
      }
      console.log(`[repair-orphans] Checking ${r.table}.${r.column}... clean.`);
    }

    if (DRY_RUN) {
      console.log('[repair-orphans] dry-run mode: no writes performed.');
      return 0;
    }

    // 4) Final verification across all repaired relations.
    for (const r of [...NULL_REPAIRS, ...DELETE_REPAIRS]) {
      if (!(await tableExists(pool, r.table)) || !(await tableExists(pool, r.parent))) continue;
      const remaining = await countOrphans(pool, r.table, r.column, r.parent, r.parentCol);
      if (remaining !== 0) {
        console.error(`[repair-orphans] FAILED: ${remaining} orphaned ${r.table}.${r.column} row(s) remain.`);
        return 1;
      }
    }
    console.log(`[repair-orphans] verified: 0 orphans remain (${repairedTotal} row(s) repaired this run).`);
    console.log('[repair-orphans] Complete.');
    return 0;
  } catch (err) {
    console.error('[repair-orphans] ERROR:', err.message || err);
    return 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

run().then((code) => process.exit(code));
