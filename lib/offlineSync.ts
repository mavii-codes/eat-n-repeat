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
}

let dbPromise: Promise<IDBPDatabase<EatNRepeatOfflineDB>> | null = null;

if (typeof window !== 'undefined') {
  dbPromise = openDB<EatNRepeatOfflineDB>('eat-n-repeat-offline-db', 1, {
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
