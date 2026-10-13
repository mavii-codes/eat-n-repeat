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
  offline_status_changes: {
    key: string;
    value: OfflineStatusChange;
    indexes: { 'by-status': string };
  };
}

let dbPromise: Promise<IDBPDatabase<EatNRepeatOfflineDB>> | null = null;

if (typeof window !== 'undefined') {
  dbPromise = openDB<EatNRepeatOfflineDB>('eat-n-repeat-offline-db', 2, {
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
      if (!db.objectStoreNames.contains('offline_status_changes')) {
        const statusStore = db.createObjectStore('offline_status_changes', { keyPath: 'orderId' });
        statusStore.createIndex('by-status', 'syncStatus');
      }
    },
  });
}

// ── ORDERS ──────────────────────────

export async function saveOfflineOrder(order: Omit<OfflineOrder, 'syncStatus' | 'timestamp'>) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('offline_orders', {
    ...order,
    syncStatus: 'pending',
    timestamp: new Date().toISOString(),
  });
}

export async function getPendingOfflineOrders() {
  if (!dbPromise) return [];
  const db = await dbPromise;
  return db.getAllFromIndex('offline_orders', 'by-status', 'pending');
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

export function journalOrder(o: { id: string; time: string; items: string; total: number; status: string; paid: boolean; notes?: string; address?: string | null; customerNotes?: string | null }): void {  try {
    const p = saveOfflineOrder({ id: o.id, time: o.time, items: o.items, total: o.total, status: o.status, paid: o.paid, notes: o.notes ?? "", address: o.address ?? null, customerNotes: o.customerNotes ?? null });
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
export function journalPayment(p: { orderId: string; method: string; cashReceived?: number | null }): void {
  try {
    const q = saveOfflinePayment({ ...p, paidAt: new Date().toISOString() });
    if (q && typeof (q as any).catch === "function") (q as any).catch(() => {});
  } catch { /* journaling must never break a sale */ }
}

// ── STATUS CHANGES (staff updates while offline) ──────

export async function saveOfflineStatusChange(change: Omit<OfflineStatusChange, 'syncStatus' | 'timestamp' | 'updatedAt'> & { updatedAt?: string }) {
  if (!dbPromise) return;
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
