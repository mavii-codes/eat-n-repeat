import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface OfflineStockTransaction {
  id: string;
  stockItemId: string;
  quantityDeducted: number;
  orderId: string;
  staffId: string;
  timestamp: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
}

export interface OfflineOrder {
  id: string; // The POS ID (e.g., POS-2026...)
  time: string;
  items: string;
  total: number;
  status: string;
  paid: boolean;
  notes: string;
  // Fulfillment type at sale time (delivery/pickup/dine-in). Optional so
  // older queued entries without it still validate and replay as dine-in.
  type?: string;
  // Customer-facing fields carried through offline sync so the replayed
  // order keeps its delivery address and customer notes. Optional so older
  // queued entries (markers only) still validate.
  address?: string | null;
  customerNotes?: string | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  timestamp: string;
}

export interface OfflinePayment {
  // Server order id (or order number for rows the server hasn't seen).
  // Same key => re-marks overwrite, never duplicate.
  orderId: string;
  method: string;
  cashReceived?: number | null;
  paidAt: string;
  // Originating staff (POS) for drawer attribution on replay. Optional so
  // older queued entries without it still validate.
  staffId?: string | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  timestamp: string;
}

export interface OfflineStatusChange {
  // Identifier the PATCH would have used, plus the order-number fallback.
  // Same order => latest change overwrites (server still applies priority).
  orderId: string;
  fallbackIdentifier?: string | null;
  status: string;
  updatedAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  timestamp: string;
}

export interface OfflineShiftOp {
  // Client-generated shift id (shift-<uuid>). Same id => replays overwrite,
  // never duplicate. Starts replay before orders/payments; closes replay
  // after them so expectedCash includes replayed sales.
  shiftId: string;
  kind: 'start' | 'close';
  staffId: string;
  startingFloat?: number | null;
  actualCash?: number | null;
  notes?: string | null;
  at: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  timestamp: string;
}

export interface OfflineExpense {
  id: string; // exp-<uuid>
  shiftId: string;
  amount: number;
  category: string;
  reason: string;
  note?: string | null;
  staffId?: string | null;
  at: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  timestamp: string;
}

interface EatNRepeatOfflineDB extends DBSchema {
  offline_orders: {
    key: string;
    value: OfflineOrder;
    indexes: { 'by-status': string };
  };
  offline_stock_transactions: {
    key: string;
    value: OfflineStockTransaction;
    indexes: { 'by-status': string; 'by-item': string };
  };
  offline_payments: {
    key: string;
    value: OfflinePayment;
    indexes: { 'by-status': string };
  };
  offline_expenses: {
    key: string;
    value: OfflineExpense;
    indexes: { 'by-status': string };
  };
  offline_status_changes: {
    key: string;
    value: OfflineStatusChange;
    indexes: { 'by-status': string };
  };
  offline_shift_ops: {
    key: string;
    value: OfflineShiftOp;
    indexes: { 'by-status': string };
  };
}

let dbPromise: Promise<IDBPDatabase<EatNRepeatOfflineDB>> | null = null;

if (typeof window !== 'undefined') {
  dbPromise = openDB<EatNRepeatOfflineDB>('eat-n-repeat-offline-db', 4, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('offline_orders')) {
        const orderStore = db.createObjectStore('offline_orders', { keyPath: 'id' });
        orderStore.createIndex('by-status', 'syncStatus');
      }
      if (!db.objectStoreNames.contains('offline_stock_transactions')) {
        const txStore = db.createObjectStore('offline_stock_transactions', { keyPath: 'id' });
        txStore.createIndex('by-status', 'syncStatus');
        txStore.createIndex('by-item', 'stockItemId');
      }
      if (!db.objectStoreNames.contains('offline_payments')) {
        const payStore = db.createObjectStore('offline_payments', { keyPath: 'orderId' });
        payStore.createIndex('by-status', 'syncStatus');
      }
      if (!db.objectStoreNames.contains('offline_expenses')) {
        const expStore = db.createObjectStore('offline_expenses', { keyPath: 'id' });
        expStore.createIndex('by-status', 'syncStatus');
      }
      if (!db.objectStoreNames.contains('offline_status_changes')) {
        const statusStore = db.createObjectStore('offline_status_changes', { keyPath: 'orderId' });
        statusStore.createIndex('by-status', 'syncStatus');
      }
      if (!db.objectStoreNames.contains('offline_shift_ops')) {
        const shiftStore = db.createObjectStore('offline_shift_ops', { keyPath: 'shiftId' });
        shiftStore.createIndex('by-status', 'syncStatus');
      }
    },
  });
}

// ── ORDERS ──────────────────────────

export async function saveOfflineOrder(order: Omit<OfflineOrder, 'syncStatus' | 'timestamp'>) {
  if (!dbPromise) return;
  // Delivery is ONLINE ONLY: never save or queue delivery orders offline!
  if (order.type === 'delivery') {
    console.warn('[OFFLINE] Delivery orders are online-only and cannot be queued offline.');
    return;
  }
  const db = await dbPromise;
  await db.put('offline_orders', {
    ...order,
    syncStatus: 'pending',
    timestamp: new Date().toISOString(),
  });
}

export async function getPendingOfflineOrders(): Promise<OfflineOrder[]> {
  if (!dbPromise) return [];
  const db = await dbPromise;
  const all = await db.getAllFromIndex('offline_orders', 'by-status', 'pending');
  // Panel recommendation: Customer offline orders and Delivery orders MUST NEVER sync.
  // Only walk-in POS orders (POS- prefix) sync to the online backend.
  return all.filter((o) => o.id.startsWith('POS-') && o.notes !== 'cart-offline' && o.type !== 'delivery');
}

/**
 * Audit and review legacy customer offline orders in browser storage.
 * Does NOT delete or upload. Exports to localStorage for owner review.
 */
export async function reviewLegacyCustomerOfflineOrders(): Promise<{
  count: number;
  orders: OfflineOrder[];
}> {
  if (!dbPromise) return { count: 0, orders: [] };
  const db = await dbPromise;
  const all = await db.getAll('offline_orders');
  const legacy = all.filter(
    (o) => !o.id.startsWith('POS-') || o.notes === 'cart-offline'
  );
  if (typeof window !== 'undefined' && legacy.length > 0) {
    try {
      window.localStorage.setItem(
        'legacy_customer_offline_orders_review',
        JSON.stringify(legacy, null, 2)
      );
      console.warn(
        `[OFFLINE CLEANUP AUDIT] Found ${legacy.length} legacy customer offline order(s). Saved to localStorage 'legacy_customer_offline_orders_review' for review. Not purged.`
      );
    } catch {
      // Storage full / unavailable
    }
  }
  return { count: legacy.length, orders: legacy };
}

export async function markOrdersSynced(ids: string[]) {
  if (!dbPromise) return;
  const db = await dbPromise;
  const tx = db.transaction('offline_orders', 'readwrite');
  for (const id of ids) {
    const item = await tx.store.get(id);
    if (item) {
      item.syncStatus = 'synced';
      await tx.store.put(item);
    }
  }
  await tx.done;
}

export async function clearSyncedOrders() {
  if (!dbPromise) return;
  const db = await dbPromise;
  const tx = db.transaction('offline_orders', 'readwrite');
  const index = tx.store.index('by-status');
  const keys = await index.getAllKeys('synced');
  for (const key of keys) {
    await tx.store.delete(key);
  }
  await tx.done;
}


// ── STOCK TRANSACTIONS ──────────────

export async function saveOfflineStockTransaction(tx: Omit<OfflineStockTransaction, 'syncStatus' | 'timestamp'>) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('offline_stock_transactions', {
    ...tx,
    syncStatus: 'pending',
    timestamp: new Date().toISOString(),
  });
}

export async function getPendingStockTransactions() {
  if (!dbPromise) return [];
  const db = await dbPromise;
  return db.getAllFromIndex('offline_stock_transactions', 'by-status', 'pending');
}

export async function markStockTransactionsSynced(ids: string[]) {
  if (!dbPromise) return;
  const db = await dbPromise;
  const tx = db.transaction('offline_stock_transactions', 'readwrite');
  for (const id of ids) {
    const item = await tx.store.get(id);
    if (item) {
      item.syncStatus = 'synced';
      await tx.store.put(item);
    }
  }
  await tx.done;
}

export async function clearSyncedStockTransactions() {
  if (!dbPromise) return;
  const db = await dbPromise;
  const tx = db.transaction('offline_stock_transactions', 'readwrite');
  const index = tx.store.index('by-status');
  const keys = await index.getAllKeys('synced');
  for (const key of keys) {
    await tx.store.delete(key);
  }
  await tx.done;
}

/**
 * Queue a stock deduction for the drain. Never throws.
 *
 * NOTE: deliberately unwired from sale flows — there is no menu→ingredient
 * recipe (BOM) in this system, and deriving deductions from fuzzy
 * name-matching would corrupt inventory. Online checkout does not deduct
 * stock either, so offline replays not deducting keeps both paths
 * consistent. Provided for future callers that carry an explicit
 * stockItemId (e.g. a recipe-aware flow); the drain + "Pending Sync"
 * badges already consume this queue.
 */
export function journalStockTransaction(t: {
  id: string;
  stockItemId: string;
  quantityDeducted: number;
  orderId: string;
  staffId: string;
}): void {
  try {
    const p = saveOfflineStockTransaction({ ...t });
    if (p && typeof (p as any).catch === "function") (p as any).catch(() => {});
  } catch { /* journaling must never break a sale */ }
}

// ── JOURNAL HELPER ─────────────────────

export function journalOrder(o: { id: string; time: string; items: string; total: number; status: string; paid: boolean; notes?: string; address?: string | null; customerNotes?: string | null; type?: string }): void {  try {
    const p = saveOfflineOrder({ id: o.id, time: o.time, items: o.items, total: o.total, status: o.status, paid: o.paid, notes: o.notes ?? "", address: o.address ?? null, customerNotes: o.customerNotes ?? null, ...(o.type ? { type: o.type } : {}) });
    if (p && typeof (p as any).catch === "function") (p as any).catch(() => {});
  } catch { /* journaling must never break a sale */ }
}

/**
 * Remove one queued order (e.g. a previously-failed submit that has since
 * succeeded online under a new id). Never throws; missing keys are no-ops.
 */
export async function removeOfflineOrder(id: string): Promise<void> {
  try {
    if (!dbPromise || !id) return;
    const db = await dbPromise;
    await db.delete('offline_orders', id);
  } catch {
    // Best-effort cleanup only.
  }
}

// ── PAYMENTS (mark-paid while offline) ──────

export async function saveOfflinePayment(payment: Omit<OfflinePayment, 'syncStatus' | 'timestamp'>) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('offline_payments', {
    ...payment,
    syncStatus: 'pending',
    timestamp: new Date().toISOString(),
  });
}

export async function getPendingOfflinePayments() {
  if (!dbPromise) return [];
  const db = await dbPromise;
  return db.getAllFromIndex('offline_payments', 'by-status', 'pending');
}

export async function markPaymentsSynced(orderIds: string[]) {
  if (!dbPromise) return;
  const db = await dbPromise;
  const tx = db.transaction('offline_payments', 'readwrite');
  for (const id of orderIds) {
    const item = await tx.store.get(id);
    if (item) {
      item.syncStatus = 'synced';
      await tx.store.put(item);
    }
  }
  await tx.done;
}

export async function clearSyncedOfflinePayments() {
  if (!dbPromise) return;
  const db = await dbPromise;
  const tx = db.transaction('offline_payments', 'readwrite');
  const index = tx.store.index('by-status');
  const keys = await index.getAllKeys('synced');
  for (const key of keys) {
    await tx.store.delete(key);
  }
  await tx.done;
}

/** Queue a cash collection that must reach the server. Never throws. */
export function journalPayment(p: { orderId: string; method: string; cashReceived?: number | null; staffId?: string | null }): void {
  try {
    const q = saveOfflinePayment({ ...p, paidAt: new Date().toISOString() });
    if (q && typeof (q as any).catch === "function") (q as any).catch(() => {});
  } catch { /* journaling must never break a sale */ }
}

export async function saveOfflineStatusChange(change: Omit<OfflineStatusChange, 'syncStatus' | 'timestamp' | 'updatedAt'> & { updatedAt?: string }) {
  if (!dbPromise) return;
  // Delivery is ONLINE ONLY: delivery status transitions cannot be queued offline
  if (change.status === 'out_for_delivery' || change.status === 'delivered') {
    console.warn('[OFFLINE] Delivery status changes are online-only and cannot be queued offline.');
    return;
  }
  const db = await dbPromise;
  await db.put('offline_status_changes', {
    ...change,
    updatedAt: change.updatedAt ?? new Date().toISOString(),
    syncStatus: 'pending',
    timestamp: new Date().toISOString(),
  });
}

export async function getPendingOfflineStatusChanges() {
  if (!dbPromise) return [];
  const db = await dbPromise;
  return db.getAllFromIndex('offline_status_changes', 'by-status', 'pending');
}

export async function markStatusChangesSynced(orderIds: string[]) {
  if (!dbPromise) return;
  const db = await dbPromise;
  const tx = db.transaction('offline_status_changes', 'readwrite');
  for (const id of orderIds) {
    const item = await tx.store.get(id);
    if (item) {
      item.syncStatus = 'synced';
      await tx.store.put(item);
    }
  }
  await tx.done;
}

export async function clearSyncedOfflineStatusChanges() {
  if (!dbPromise) return;
  const db = await dbPromise;
  const tx = db.transaction('offline_status_changes', 'readwrite');
  const index = tx.store.index('by-status');
  const keys = await index.getAllKeys('synced');
  for (const key of keys) {
    await tx.store.delete(key);
  }
  await tx.done;
}

/** Queue a staff status change that must reach the server. Never throws. */
export function journalStatusChange(c: { orderId: string; fallbackIdentifier?: string | null; status: string }): void {
  try {
    const q = saveOfflineStatusChange({ ...c, updatedAt: new Date().toISOString() });
    if (q && typeof (q as any).catch === "function") (q as any).catch(() => {});
  } catch { /* journaling must never break the UI */ }
}

// ── SHIFT OPS (start/close while offline) ──────

export async function saveOfflineShiftOp(op: Omit<OfflineShiftOp, 'syncStatus' | 'timestamp'>) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('offline_shift_ops', {
    ...op,
    syncStatus: 'pending',
    timestamp: new Date().toISOString(),
  });
}

export async function getPendingOfflineShiftOps() {
  if (!dbPromise) return [];
  const db = await dbPromise;
  return db.getAllFromIndex('offline_shift_ops', 'by-status', 'pending');
}

export async function markShiftOpsSynced(shiftIds: string[]) {
  if (!dbPromise) return;
  const db = await dbPromise;
  const tx = db.transaction('offline_shift_ops', 'readwrite');
  for (const id of shiftIds) {
    const item = await tx.store.get(id);
    if (item) {
      item.syncStatus = 'synced';
      await tx.store.put(item);
    }
  }
  await tx.done;
}

export async function clearSyncedOfflineShiftOps() {
  if (!dbPromise) return;
  const db = await dbPromise;
  const tx = db.transaction('offline_shift_ops', 'readwrite');
  const index = tx.store.index('by-status');
  const keys = await index.getAllKeys('synced');
  for (const key of keys) {
    await tx.store.delete(key);
  }
  await tx.done;
}

/** Queue a shift start/close that must reach the server. Never throws. */
export function journalShiftOp(op: {
  shiftId: string;
  kind: 'start' | 'close';
  staffId: string;
  startingFloat?: number | null;
  actualCash?: number | null;
  notes?: string | null;
}): void {
  try {
    const q = saveOfflineShiftOp({ ...op, at: new Date().toISOString() });
    if (q && typeof (q as any).catch === "function") (q as any).catch(() => {});
  } catch { /* journaling must never break the UI */ }
}

// ── EXPENSES (DRAWER PAID-OUTS) ─────────────

export async function saveOfflineExpense(expense: Omit<OfflineExpense, 'syncStatus' | 'timestamp'>) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('offline_expenses', {
    ...expense,
    syncStatus: 'pending',
    timestamp: new Date().toISOString(),
  });
}

export async function getPendingOfflineExpenses(): Promise<OfflineExpense[]> {
  if (!dbPromise) return [];
  const db = await dbPromise;
  return db.getAllFromIndex('offline_expenses', 'by-status', 'pending');
}

export async function markExpensesSynced(ids: string[]) {
  if (!dbPromise) return;
  const db = await dbPromise;
  const tx = db.transaction('offline_expenses', 'readwrite');
  for (const id of ids) {
    const item = await tx.store.get(id);
    if (item) {
      item.syncStatus = 'synced';
      await tx.store.put(item);
    }
  }
  await tx.done;
}

export async function clearSyncedOfflineExpenses() {
  if (!dbPromise) return;
  const db = await dbPromise;
  const tx = db.transaction('offline_expenses', 'readwrite');
  const index = tx.store.index('by-status');
  const keys = await index.getAllKeys('synced');
  for (const key of keys) {
    await tx.store.delete(key);
  }
  await tx.done;
}

/** Queue a drawer paid-out expense while offline. Never throws. */
export function journalExpense(e: {
  id: string;
  shiftId: string;
  amount: number;
  category: string;
  reason: string;
  note?: string | null;
  staffId?: string | null;
}): void {
  try {
    const q = saveOfflineExpense({ ...e, at: new Date().toISOString() });
    if (q && typeof (q as any).catch === "function") (q as any).catch(() => {});
  } catch { /* journaling must never break the UI */ }
}
