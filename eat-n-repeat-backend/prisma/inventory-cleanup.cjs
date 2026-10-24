/* Inventory cleanup — reversible + idempotent. Approved 2026-10-24.
 *
 * ACTIONS (from the approved Step 0 classification):
 *   1. Archive stock item si-6f12f5bf ("Test Item Sync 1792776302905") — it has
 *      real movements/layers, so it is archived, not deleted. History preserved.
 *   2. Link-label it kind="menu" (it is linked to a menu item).
 *   3. Archive its linked menu item mi-e1fc86ba (currently live on the customer
 *      menu). Menu archive = archived flag only; no menu or stock rows deleted.
 *   4. Assert st-1..st-6 stay kind="ingredient" (fix the label if drifted).
 *
 * REVERSIBILITY (manual, via mysql or prisma studio):
 *   UPDATE stock_items SET archived = 0, archived_at = NULL WHERE id = 'si-6f12f5bf';
 *   UPDATE menu_items  SET archived = 0, archived_at = NULL WHERE id = 'mi-e1fc86ba';
 *
 * IDEMPOTENCE: archiving skips rows already archived; label fixes only run when
 * the value differs. running --apply twice changes no data (the log file grows
 * by "skipped" lines only). Full DB revert point: C:\Eat n RepEat Cafe\backup.sql
 *
 * Usage:
 *   node prisma/inventory-cleanup.cjs            # dry-run (prints, no writes)
 *   node prisma/inventory-cleanup.cjs --apply    # execute + log
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const TEST_STOCK_ITEMS = ["si-6f12f5bf"]; // Test Item Sync 1792776302905
const TEST_MENU_ITEMS = ["mi-e1fc86ba"]; // Test Item Sync 1792776302905
const INGREDIENT_IDS = ["st-1", "st-2", "st-3", "st-4", "st-5", "st-6"];
const LOG = path.join(__dirname, "inventory-cleanup.log");

function logLine(line) {
  const stamp = new Date().toISOString();
  const full = `[${stamp}] [${APPLY ? "APPLY" : "DRY-RUN"}] ${line}`;
  console.log(full);
  fs.appendFileSync(LOG, full + "\n");
}

async function main() {
  logLine("=== run start ===");

  // 1-2. Archive the test stock item + label it menu-linked.
  for (const id of TEST_STOCK_ITEMS) {
    const item = await prisma.stockItem.findUnique({ where: { id } });
    if (!item) {
      logLine(`stock_item ${id}: not found (already removed or never created) — skipped`);
      continue;
    }
    if (item.archived) {
      logLine(`stock_item ${id} (${item.name}): already archived — skipped`);
    } else if (APPLY) {
      await prisma.stockItem.update({
        where: { id },
        data: { archived: true, archivedAt: new Date(), kind: "menu" },
      });
      logLine(`stock_item ${id} (${item.name}): archived + kind -> "menu" (movements/layers untouched)`);
    } else {
      logLine(`WOULD archive stock_item ${id} (${item.name}), kind -> "menu"`);
    }
  }

  // 3. Archive the test menu item (live on the customer menu right now).
  for (const id of TEST_MENU_ITEMS) {
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) {
      logLine(`menu_item ${id}: not found — skipped`);
      continue;
    }
    if (item.archived) {
      logLine(`menu_item ${id} (${item.name}): already archived — skipped`);
    } else if (APPLY) {
      await prisma.menuItem.update({
        where: { id },
        data: { archived: true, archivedAt: new Date() },
      });
      logLine(`menu_item ${id} (${item.name}): archived (stock item left unlinked-but-preserved)`);
    } else {
      logLine(`WOULD archive menu_item ${id} (${item.name})`);
    }
  }

  // 4. Real pantry items keep their Ingredient label.
  for (const id of INGREDIENT_IDS) {
    const item = await prisma.stockItem.findUnique({ where: { id } });
    if (!item) {
      logLine(`stock_item ${id}: not found — skipped`);
      continue;
    }
    if (item.kind !== "ingredient") {
      if (APPLY) {
        await prisma.stockItem.update({ where: { id }, data: { kind: "ingredient" } });
        logLine(`stock_item ${id} (${item.name}): kind "${item.kind}" -> "ingredient"`);
      } else {
        logLine(`WOULD set kind "ingredient" on stock_item ${id} (${item.name}, current "${item.kind}")`);
      }
    } else {
      logLine(`stock_item ${id} (${item.name}): kind already "ingredient" — skipped`);
    }
  }

  const [total, archived] = [
    await prisma.stockItem.count(),
    await prisma.stockItem.count({ where: { archived: true } }),
  ];
  logLine(`totals: stock_items=${total} archived=${archived}`);
  logLine("=== run end ===");
}

main()
  .catch((e) => {
    logLine("FAILED: " + (e && e.message));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
