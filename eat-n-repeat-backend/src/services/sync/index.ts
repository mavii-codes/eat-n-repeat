import { getSyncStatusService } from "./get-sync-status";
import { pushSyncService } from "./push-sync";
import { offlineSyncService } from "./offline-sync";

export async function getSyncStatus() {
  return getSyncStatusService.execute();
}

export async function pushSync(data: {
  orders?: any[];
  payments?: any[];
  customers?: any[];
  staff_notifications?: any[];
}) {
  return pushSyncService.execute(data);
}

export async function offlineSync(
  data: {
    offline_orders?: any[];
    offline_stock_transactions?: any[];
    offline_payments?: any[];
    offline_expenses?: any[];
    offline_status_changes?: any[];
    offline_shifts?: any[];
  },
  drainingUserId?: string | null,
) {
  return offlineSyncService.execute(data, drainingUserId ?? null);
}
