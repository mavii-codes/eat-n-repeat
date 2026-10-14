import { syncRepository } from "@/repositories/sync.repository";

export class OfflineSyncService {
  async execute(
    data: {
      offline_orders?: any[];
      offline_stock_transactions?: any[];
      offline_payments?: any[];
      offline_status_changes?: any[];
      offline_shifts?: any[];
    },
    drainingUserId?: string | null,
  ) {
    const { offline_orders, offline_stock_transactions, offline_payments, offline_status_changes, offline_shifts } = data;
    await syncRepository.executeOfflineSync(
      offline_orders || [],
      offline_stock_transactions || [],
      offline_payments || [],
      offline_status_changes || [],
      offline_shifts || [],
      drainingUserId ?? null,
    );
  }
}

export const offlineSyncService = new OfflineSyncService();
