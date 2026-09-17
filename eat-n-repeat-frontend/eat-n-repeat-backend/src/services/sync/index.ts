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

export async function offlineSync(data: {
  offline_orders?: any[];
  offline_stock_transactions?: any[];
}) {
  return offlineSyncService.execute(data);
}
