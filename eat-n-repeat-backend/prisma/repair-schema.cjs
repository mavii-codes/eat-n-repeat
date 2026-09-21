/**
 * repair-schema.cjs — one-time, idempotent pre-push schema reconciliation for LOCAL MySQL.
 *
 * Problem: very old local databases (raw-SQL era, before Prisma managed the
 * schema) carry a leftover plain index named `cash_tx_shift_fk` on
 * `cash_transactions(shift_id)` — a name that never existed in any Prisma
 * schema version. When `prisma db push` reconciles toward the schema-mapped
 * index (`cash_transactions_shift_id_fkey`), its DROP/REDEFINE step misfires
 * with: "Can't DROP INDEX cash_tx_shift_fk; check that it exists".
 *
 * Fix (non-destructive): ensure that exact index exists BEFORE push runs.
 * - If present: no-op.
 * - If absent: CREATE it (plain secondary index on shift_id, online operation
 *   on café-scale tables). `db push` then drops/replaces it per the schema
 *   and proceeds. Creating an index never destroys data and cannot break
 *   queries; the worst case is a redundant index that push itself removes.
 * - If the table itself is missing (fresh database): skip, push creates it.
 * - Any other failure: exit non-zero so bootstrap aborts LOUDLY instead of
 *   hiding the Prisma error.
 *
 * Usage (from eat-n-repeat-backend/):
 *   node prisma/repair-schema.cjs            # repair
 *   node prisma/repair-schema.cjs --dry-run  # report only, writes nothing
 *
 * Exit codes: 0 = clean (or nothing to do), 1 = unresolved problem.
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

const DRY_RUN = process.argv.includes('--dry-run');

// { table, column, indexName } — plain secondary indexes push expects to replace.
const ENSURE_INDEXES = [
  { table: 'cash_transactions', column: 'shift_id', indexName: 'cash_tx_shift_fk' },
];

async function tableExists(pool, name) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [name]
  );
  return Number(rows[0].n) > 0;
}

async function indexExists(pool, table, indexName) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
    [table, indexName]
  );
  return Number(rows[0].n) > 0;
}

async function listIndexes(pool, table) {
  const [rows] = await pool.query(
    'SELECT DISTINCT index_name AS name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ?',
    [table]
  );
  return rows.map((r) => r.name);
}

async function constraintExists(pool, table, name) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ?',
    [table, name]
  );
  return Number(rows[0].n) > 0;
}

async function run() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  try {
    for (const item of ENSURE_INDEXES) {
      console.log(`[schema-repair] Checking ${item.table} indexes...`);
      if (!(await tableExists(pool, item.table))) {
        console.log(`[schema-repair] Table ${item.table} missing (fresh database) — nothing to repair.`);
        continue;
      }
      const existing = await listIndexes(pool, item.table);
      console.log(`[schema-repair] Existing indexes on ${item.table}: ${existing.join(', ') || '(none)'}`);
      if (await indexExists(pool, item.table, item.indexName)) {
        console.log(`[schema-repair] Index ${item.indexName} present — nothing to do.`);
        continue;
      }
      if (await constraintExists(pool, item.table, item.indexName)) {
        console.log(
          `[schema-repair] A constraint named ${item.indexName} exists (backing index required) — leaving it for db push to reconcile.`
        );
        continue;
      }
      if (DRY_RUN) {
        console.log(`[schema-repair] dry-run mode: would CREATE INDEX ${item.indexName} — no writes performed.`);
        continue;
      }
      await pool.query(
        `CREATE INDEX \`${item.indexName}\` ON \`${item.table}\` (\`${item.column}\`)`
      );
      console.log(`[schema-repair] Created missing index ${item.indexName} on ${item.table}(${item.column}).`);
    }
    console.log('[schema-repair] Complete.');
    return 0;
  } catch (err) {
    console.error('[schema-repair] ERROR:', err.message || err);
    return 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

run().then((code) => process.exit(code));
