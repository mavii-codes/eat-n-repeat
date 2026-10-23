/**
 * opening-layers.cjs — one-time, idempotent Phase B backfill.
 *
 * Gives every existing stock item a FIFO opening layer equal to the gap
 * between its stored quantity and the sum of its current layers, and records
 * one OPENING_BALANCE movement. Items that already have an OPENING_BALANCE
 * movement are skipped (that movement is the idempotency marker), as are
 * zero-quantity items and items whose layers already cover the on-hand qty.
 *
 * Run manually once after `prisma db push` (NOT wired into server boot):
 *   node prisma/opening-layers.cjs
 *
 * Exit codes: 0 = every item's layer sum matches its quantity, 1 = mismatch
 * or unexpected error. A second run writes 0 rows.
 */
const crypto = require('crypto');
const { PrismaClient, Prisma } = require('@prisma/client');
require('dotenv').config({ path: './.env' });

const prisma = new PrismaClient();
const D = (value) => new Prisma.Decimal(value);

async function backfillItem(item) {
  return prisma.$transaction(async (tx) => {
    // Lock the item row FIRST (engine deadlock invariant), then layers.
    const lockedRows = await tx.$queryRaw`
      SELECT id, name, quantity FROM stock_items WHERE id = ${item.id} FOR UPDATE
    `;
    if (lockedRows.length === 0) {
      return { outcome: 'skip', reason: 'missing' };
    }
    const row = lockedRows[0];
    const quantity = D(row.quantity);

    if (quantity.isZero()) {
      return { outcome: 'skip', reason: 'zero quantity' };
    }

    const opening = await tx.stockMovement.findFirst({
      where: { stockItemId: item.id, type: 'OPENING_BALANCE' },
      select: { id: true },
    });
    if (opening) {
      return { outcome: 'skip', reason: 'opening movement exists' };
    }

    const layerRows = await tx.$queryRaw`
      SELECT remaining FROM stock_layers WHERE stock_item_id = ${item.id} FOR UPDATE
    `;
    let layerTotal = D(0);
    for (const layer of layerRows) {
      layerTotal = layerTotal.plus(D(layer.remaining));
    }

    const gap = Prisma.Decimal.max(D(0), quantity.minus(layerTotal));
    if (gap.isZero()) {
      return { outcome: 'skip', reason: 'layers already cover quantity' };
    }

    const costRows = await tx.$queryRaw`
      SELECT unit_cost AS unitCost
      FROM stock_movements
      WHERE stock_item_id = ${item.id} AND unit_cost IS NOT NULL
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `;
    const unitCost = costRows.length > 0 ? D(costRows[0].unitCost) : null;

    await tx.stockLayer.create({
      data: {
        id: `sl-${crypto.randomUUID()}`,
        stockItemId: item.id,
        unitCost,
        remaining: gap,
        sourceRef: 'opening',
      },
    });

    await tx.stockMovement.create({
      data: {
        id: `sm-${crypto.randomUUID()}`,
        stockItemId: item.id,
        itemName: row.name,
        type: 'OPENING_BALANCE',
        quantityChange: gap,
        balanceBefore: gap,
        balanceAfter: quantity,
        unitCost: null,
        totalCost: null,
        reason: 'Backfilled opening layers',
        reference: null,
        receivedAt: null,
        expiryDate: null,
        createdById: 'system-backfill',
        createdByName: 'Backfill (system)',
      },
    });

    return { outcome: 'touched', quantity, gap, unitCost };
  });
}

async function run() {
  const items = await prisma.stockItem.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  let touched = 0;
  let skipped = 0;

  for (const item of items) {
    try {
      const result = await backfillItem(item);
      if (result.outcome === 'touched') {
        touched += 1;
        console.log(
          `[opening-layers] ${item.name}: +layer ${result.gap.toString()} ` +
            `(qty ${result.quantity.toString()}, unitCost ${result.unitCost ? result.unitCost.toString() : 'null'})`,
        );
      } else {
        skipped += 1;
        console.log(`[opening-layers] ${item.name}: skipped (${result.reason})`);
      }
    } catch (error) {
      console.error(`[opening-layers] ${item.name}: FAILED — ${error.message || error}`);
      throw error;
    }
  }

  // Verification pass: every item's layer sum must equal its quantity.
  const verifyItems = await prisma.stockItem.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, quantity: true },
  });
  const grouped = await prisma.stockLayer.groupBy({
    by: ['stockItemId'],
    _sum: { remaining: true },
  });
  const layerSums = new Map(
    grouped.map((row) => [row.stockItemId, D(row._sum.remaining ?? 0)]),
  );

  let mismatches = 0;
  console.log('\n[opening-layers] verification');
  console.log('name | quantity | sum(layers) | status');
  for (const item of verifyItems) {
    const quantity = D(item.quantity);
    const layerSum = layerSums.get(item.id) ?? D(0);
    const match = layerSum.equals(quantity);
    if (!match) mismatches += 1;
    console.log(
      `${item.name} | ${quantity.toString()} | ${layerSum.toString()} | ${match ? 'MATCH' : 'MISMATCH'}`,
    );
  }

  console.log(
    `\n[opening-layers] touched=${touched} skipped=${skipped} ` +
      `layers_written=${touched} movements_written=${touched} mismatches=${mismatches}`,
  );

  if (mismatches !== 0) {
    console.error('[opening-layers] FAILED: layer sums do not match item quantities.');
    return 1;
  }
  console.log('[opening-layers] Complete.');
  return 0;
}

run()
  .then(async (code) => {
    await prisma.$disconnect().catch(() => {});
    process.exit(code);
  })
  .catch(async (error) => {
    console.error('[opening-layers] ERROR:', error.message || error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
