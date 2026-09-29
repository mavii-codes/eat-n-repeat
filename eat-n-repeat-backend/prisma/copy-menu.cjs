/**
 * copy-menu.cjs — ONE-TIME copy of menu_categories + menu_items from a source
 * MySQL database to a target MySQL database (e.g. local XAMPP -> Aiven).
 *
 * Safety rules (non-negotiable, enforced in code):
 * - Source is ALWAYS read-only (SELECT only, in every mode).
 * - Default mode is DRY-RUN: prints exactly what would happen, writes NOTHING.
 * - Live writes require the explicit `--live` flag and are INSERT-only.
 *   No UPDATEs, no DELETEs, no other tables. Ever.
 * - Matching is by ID first, then by name (case-insensitive). Existing rows
 *   are SKIPPED and reported, never overwritten (skip-and-report).
 * - Refuses to run when source and target point at the same database.
 * - Aborts if the target lacks the `sizes` column (deploy the sizes build
 *   first) instead of copying menu data without sizes.
 *
 * Usage (from eat-n-repeat-backend/, PowerShell):
 *   $env:SOURCE_DATABASE_URL="mysql://root:@localhost:3306/eat_n_repeat"
 *   $env:TARGET_DATABASE_URL="<paste-Aiven-URL-from-Render-dashboard>"
 *   node prisma/copy-menu.cjs            # DRY-RUN (default, writes nothing)
 *   node prisma/copy-menu.cjs --live     # writes after dry-run approval
 *
 * Do NOT put these URLs in .env or any file. Exit codes: 0 = clean,
 * 1 = conflicts/blocks/errors (review needed).
 */
const mysql = require('mysql2/promise');

const LIVE = process.argv.includes('--live');
const HELP = process.argv.includes('--help') || process.argv.includes('-h');

function usage() {
  console.log(`
copy-menu.cjs — one-time menu copy (source -> target), dry-run by default.

  Required env:  SOURCE_DATABASE_URL, TARGET_DATABASE_URL
  node prisma/copy-menu.cjs            dry-run (writes nothing)
  node prisma/copy-menu.cjs --live     perform the copy (INSERT-only)
`);
}

function maskUrl(url) {
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, '') || '?';
    return `${u.host}/${db}`;
  } catch {
    return '(unparseable-url)';
  }
}

function normName(s) {
  return String(s ?? '').trim().toLowerCase();
}

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : String(v);
}

function samePrice(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return String(a) === String(b);
  return Math.abs(x - y) < 0.005;
}

function parseSizes(v) {
  if (v === null || v === undefined) return null; // column missing/NULL
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return [];
    try {
      const p = JSON.parse(t);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v : [];
}

function sizesLabel(v) {
  const arr = parseSizes(v) || [];
  if (arr.length === 0) return 'no sizes';
  const names = arr.map((s) => (s && s.name ? String(s.name) : '?')).join(', ');
  return `${arr.length} sizes [${names}]`;
}

function bool01(v) {
  return v ? 1 : 0;
}

function fmtDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function columnExists(conn, dbName, table, column) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, table, column]
  );
  return Number(rows[0].c) > 0;
}

async function main() {
  if (HELP) {
    usage();
    process.exit(0);
  }

  const sourceUrl = (process.env.SOURCE_DATABASE_URL || '').trim();
  const targetUrl = (process.env.TARGET_DATABASE_URL || '').trim();
  if (!sourceUrl || !targetUrl) {
    console.error('ERROR: set SOURCE_DATABASE_URL and TARGET_DATABASE_URL first (see header).');
    process.exit(1);
  }
  if (sourceUrl === targetUrl) {
    console.error('REFUSED: source and target point at the same database. Aborting.');
    process.exit(1);
  }

  console.log(`Mode: ${LIVE ? 'LIVE (INSERT-only)' : 'DRY-RUN (writes nothing)'}`);
  console.log(`Source: ${maskUrl(sourceUrl)}`);
  console.log(`Target: ${maskUrl(targetUrl)}`);

  let source;
  let target;
  try {
    source = await mysql.createConnection(sourceUrl);
  } catch (e) {
    console.error(`ERROR: cannot reach SOURCE database: ${e.message}`);
    process.exit(1);
  }
  try {
    target = await mysql.createConnection(targetUrl);
  } catch (e) {
    console.error(`ERROR: cannot reach TARGET database: ${e.message}`);
    await source.end();
    process.exit(1);
  }

  try {
    const targetDb = target.config.database;
    const targetHasSizes = await columnExists(target, targetDb, 'menu_items', 'sizes');
    if (!targetHasSizes) {
      console.error(
        'ABORT: target menu_items table has no `sizes` column. ' +
        'Deploy the backend build that includes menu sizes first, then re-run.'
      );
      process.exit(1);
    }
    const sourceDb = source.config.database;
    const sourceHasSizes = await columnExists(source, sourceDb, 'menu_items', 'sizes');
    if (!sourceHasSizes) {
      console.warn(
        'WARN: source menu_items table has no `sizes` column; source sizes will be treated as empty.'
      );
    }

    const [srcCats] = await source.execute(
      'SELECT id, name, description, archived, archived_at FROM menu_categories ORDER BY name'
    );
    const [tgtCats] = await target.execute(
      'SELECT id, name, description, archived, archived_at FROM menu_categories ORDER BY name'
    );
    const srcItemsQuery = sourceHasSizes
      ? 'SELECT id, name, description, price, category_id, available, image, sizes, archived, archived_at FROM menu_items ORDER BY name'
      : 'SELECT id, name, description, price, category_id, available, image, archived, archived_at FROM menu_items ORDER BY name';
    const [srcItems] = await source.execute(srcItemsQuery);
    const [tgtItems] = await target.execute(
      'SELECT id, name, description, price, category_id, available, image, sizes, archived, archived_at FROM menu_items ORDER BY name'
    );

    console.log(`Source rows: categories=${srcCats.length} items=${srcItems.length}`);
    console.log(`Target rows: categories=${tgtCats.length} items=${tgtItems.length}`);

    let toAddCats = [];
    let skippedCats = 0;
    let conflictCats = 0;

    const tgtCatById = new Map(tgtCats.map((c) => [String(c.id), c]));
    const tgtCatByName = new Map(tgtCats.map((c) => [normName(c.name), c]));

    for (const c of srcCats) {
      const byId = tgtCatById.get(String(c.id));
      if (byId) {
        if (normName(byId.name) === normName(c.name)) {
          console.log(`[SKIP] category "${c.name}" — already on target (id ${c.id})`);
          skippedCats += 1;
        } else {
          console.log(
            `[CONFLICT] category id ${c.id}: source "${c.name}" vs target "${byId.name}" — skipped, resolve manually`
          );
          conflictCats += 1;
        }
        continue;
      }
      const byName = tgtCatByName.get(normName(c.name));
      if (byName) {
        console.log(
          `[SKIP] category "${c.name}" — same name on target under different id (${byName.id})`
        );
        skippedCats += 1;
        continue;
      }
      console.log(`[ADD] category "${c.name}" (id ${c.id})`);
      toAddCats.push(c);
    }

    // IDs that will exist on target after the category copy (for FK safety).
    const futureCatIds = new Set([
      ...tgtCats.map((c) => String(c.id)),
      ...toAddCats.map((c) => String(c.id)),
    ]);

    let toAddItems = [];
    let skippedItems = 0;
    let conflictItems = 0;
    let blockedItems = 0;

    const tgtItemById = new Map(tgtItems.map((i) => [String(i.id), i]));
    const tgtItemByName = new Map(tgtItems.map((i) => [normName(i.name), i]));

    for (const it of srcItems) {
      const label = `"${it.name}" ${money(it.price)} ${sizesLabel(sourceHasSizes ? it.sizes : [])}`;
      const byId = tgtItemById.get(String(it.id));
      if (byId) {
        if (normName(byId.name) === normName(it.name)) {
          const diffs = [];
          if (!samePrice(byId.price, it.price)) {
            diffs.push(`price target ${money(byId.price)} vs source ${money(it.price)}`);
          }
          if (String(byId.description ?? '') !== String(it.description ?? '')) {
            diffs.push('description differs');
          }
          if (bool01(byId.available) !== bool01(it.available)) {
            diffs.push(`available target ${byId.available} vs source ${it.available}`);
          }
          const tSizes = parseSizes(byId.sizes) || [];
          const sSizes = parseSizes(sourceHasSizes ? it.sizes : []) || [];
          if (tSizes.length !== sSizes.length) {
            diffs.push(`sizes target ${tSizes.length} vs source ${sSizes.length}`);
          }
          console.log(
            `[SKIP] item ${label} — already on target (id ${it.id})` +
            (diffs.length > 0 ? ` [kept target; differs: ${diffs.join('; ')}]` : '')
          );
          skippedItems += 1;
        } else {
          console.log(
            `[CONFLICT] item id ${it.id}: source "${it.name}" vs target "${byId.name}" — skipped, resolve manually`
          );
          conflictItems += 1;
        }
        continue;
      }
      const byName = tgtItemByName.get(normName(it.name));
      if (byName) {
        console.log(
          `[SKIP] item "${it.name}" — same name on target under different id (${byName.id}); kept target`
        );
        skippedItems += 1;
        continue;
      }
      if (!futureCatIds.has(String(it.category_id))) {
        console.log(
          `[BLOCKED] item ${label} — category ${it.category_id} missing on target and not copied — skipped`
        );
        blockedItems += 1;
        continue;
      }
      console.log(`[ADD] item ${label} (id ${it.id}) -> category ${it.category_id}`);
      toAddItems.push(it);
    }

    console.log(
      `Summary: categories to add=${toAddCats.length} skipped=${skippedCats} conflicts=${conflictCats}; ` +
      `items to add=${toAddItems.length} skipped=${skippedItems} conflicts=${conflictItems} blocked=${blockedItems}`
    );

    if (!LIVE) {
      console.log('Writes: NONE (dry-run). Re-run with --live to perform the copy above.');
      process.exit(conflictCats + conflictItems + blockedItems > 0 ? 1 : 0);
    }

    let insertedCats = 0;
    for (const c of toAddCats) {
      await target.execute(
        `INSERT INTO menu_categories (id, name, description, archived, archived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(0), NOW(0))`,
        [c.id, c.name, c.description ?? null, bool01(c.archived), fmtDate(c.archived_at)]
      );
      insertedCats += 1;
    }

    let insertedItems = 0;
    let failedItems = 0;
    for (const it of toAddItems) {
      try {
        await target.execute(
          `INSERT INTO menu_items (id, name, description, price, category_id, available, image, sizes, archived, archived_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(0), NOW(0))`,
          [
            it.id,
            it.name,
            it.description ?? null,
            money(it.price),
            it.category_id,
            bool01(it.available),
            it.image ?? null,
            sourceHasSizes && it.sizes !== undefined && it.sizes !== null
              ? (typeof it.sizes === 'string' ? it.sizes : JSON.stringify(it.sizes))
              : null,
            bool01(it.archived),
            fmtDate(it.archived_at),
          ]
        );
        insertedItems += 1;
      } catch (e) {
        failedItems += 1;
        console.error(`[FAILED] item "${it.name}" (id ${it.id}): ${e.message}`);
      }
    }

    const [tgtCatsAfter] = await target.execute('SELECT COUNT(*) AS c FROM menu_categories');
    const [tgtItemsAfter] = await target.execute('SELECT COUNT(*) AS c FROM menu_items');
    console.log(
      `Writes: categories inserted=${insertedCats} items inserted=${insertedItems} failed=${failedItems}; ` +
      `target now: categories=${tgtCatsAfter[0].c} items=${tgtItemsAfter[0].c}`
    );
    process.exit(conflictCats + conflictItems + blockedItems + failedItems > 0 ? 1 : 0);
  } finally {
    try { await source.end(); } catch { /* ignore */ }
    try { await target.end(); } catch { /* ignore */ }
  }
}

main().catch((e) => {
  console.error(`ERROR: ${e && e.message ? e.message : e}`);
  process.exit(1);
});
