import { syncRepository } from "@/repositories/sync.repository";

export class OfflineSyncService {
  async execute(data: {
    offline_orders?: any[];
    offline_stock_transactions?: any[];
  }) {
    const { offline_orders, offline_stock_transactions } = data;
    await syncRepository.executeOfflineSync(offline_orders || [], offline_stock_transactions || []);
  }
}

export const offlineSyncService = new OfflineSyncService();
