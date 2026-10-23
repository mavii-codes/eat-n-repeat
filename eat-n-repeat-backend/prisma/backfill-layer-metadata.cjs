/**
 * backfill-layer-metadata.cjs — one-time, idempotent Phase B backfill.
 *
 * Fills the additive StockLayer metadata columns (received_at, expiry_date,
 * quantity_received, is_opening, source_movement_id) for rows created before
 * those columns existed. Targets are derived read-modify-write from the layer
 * itself and its linked stock movement; stock movement history is only READ.
 *
 * Rules:
 *   isOpening        = sourceRef === "opening"
 *   quantityReceived = existing ?? remaining   (legacy rows: remaining)
 *   sourceMovementId = existing ?? ("sm-" prefix on sourceRef ? sourceRef : null)
 *   receivedAt       = existing ?? movement.receivedAt ?? (opening ? createdAt : null)
 *   expiryDate       = existing ?? movement.expiryDate ?? null
 *
 * Only rows with at least one differing target are updated, so a second run
 * writes 0 rows.
 *
 * Run manually after `prisma db push` (NOT wired into server boot):
 *   node prisma/backfill-layer-metadata.cjs
 *
 * Exit codes: 0 = every item's layer sum matches its quantity, 1 = mismatch
 * or unexpected error.
 */
const { PrismaClient, Prisma } = require('@prisma/client');
require('dotenv').config({ path: './.env' });

const prisma = new PrismaClient();
const D = (value) => new Prisma.Decimal(value);

function sameDate(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

function sameDecimal(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return D(a).equals(D(b));
}

async function run() {
  const layers = await prisma.stockLayer.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  // Resolve each source movement once (bulk), not per layer.
  const movementIds = [
    ...new Set(
      layers
        .map(
          (layer) =>
            layer.sourceMovementId ??
            (layer.sourceRef && layer.sourceRef.startsWith('sm-') ? layer.sourceRef : null),
        )
        .filter(Boolean),
    ),
  ];
  const movements =
    movementIds.length > 0
      ? await prisma.stockMovement.findMany({
          where: { id: { in: movementIds } },
          select: { id: true, receivedAt: true, expiryDate: true },
        })
      : [];
  const movementById = new Map(movements.map((movement) => [movement.id, movement]));

  let updated = 0;
  let unchanged = 0;
  let missingMovements = 0;

  for (const layer of layers) {
    const targetIsOpening = layer.sourceRef === 'opening';
    const targetQuantityReceived = layer.quantityReceived ?? layer.remaining;
    const targetSourceMovementId =
      layer.sourceMovementId ??
      (layer.sourceRef && layer.sourceRef.startsWith('sm-') ? layer.sourceRef : null);
    const movement = targetSourceMovementId
      ? movementById.get(targetSourceMovementId)
      : undefined;

    if (targetSourceMovementId && !movement) {
      missingMovements += 1;
    }

    const targetReceivedAt =
      layer.receivedAt ??
      movement?.receivedAt ??
      (layer.sourceRef === 'opening' ? layer.createdAt : null);
    const targetExpiryDate = layer.expiryDate ?? movement?.expiryDate ?? null;

    const differs =
      Boolean(layer.isOpening) !== targetIsOpening ||
      !sameDecimal(layer.quantityReceived, targetQuantityReceived) ||
      (layer.sourceMovementId ?? null) !== targetSourceMovementId ||
      !sameDate(layer.receivedAt, targetReceivedAt) ||
      !sameDate(layer.expiryDate, targetExpiryDate);

    if (!differs) {
      unchanged += 1;
      continue;
    }

    await prisma.stockLayer.update({
      where: { id: layer.id },
      data: {
        isOpening: targetIsOpening,
        quantityReceived: targetQuantityReceived,
        sourceMovementId: targetSourceMovementId,
        receivedAt: targetReceivedAt,
        expiryDate: targetExpiryDate,
      },
    });
    updated += 1;
  }

  console.log(
    `[backfill-layer-metadata] layers_scanned=${layers.length} ` +
      `updated=${updated} unchanged=${unchanged} missing_movements=${missingMovements}`,
  );

  // Verification pass: every item's layer sum must equal its quantity.
  const items = await prisma.stockItem.findMany({
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
  console.log('\n[backfill-layer-metadata] verification');
  console.log('name | quantity | sum(layers) | status');
  for (const item of items) {
    const quantity = D(item.quantity);
    const layerSum = layerSums.get(item.id) ?? D(0);
    const match = layerSum.equals(quantity);
    if (!match) mismatches += 1;
    console.log(
      `${item.name} | ${quantity.toString()} | ${layerSum.toString()} | ${match ? 'MATCH' : 'MISMATCH'}`,
    );
  }

  console.log(
    `\n[backfill-layer-metadata] updated=${updated} unchanged=${unchanged} ` +
      `missing_movements=${missingMovements} mismatches=${mismatches}`,
  );

  if (mismatches !== 0) {
    console.error(
      '[backfill-layer-metadata] FAILED: layer sums do not match item quantities.',
    );
    return 1;
  }
  console.log('[backfill-layer-metadata] Complete.');
  return 0;
}

run()
  .then(async (code) => {
    await prisma.$disconnect().catch(() => {});
    process.exit(code);
  })
  .catch(async (error) => {
    console.error('[backfill-layer-metadata] ERROR:', error.message || error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
