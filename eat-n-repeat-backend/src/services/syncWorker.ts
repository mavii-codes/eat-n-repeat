import { getPool } from "../database.js";
import dns from "dns/promises";

// A configuration variable for the Cloud API.
// In a real deployment, the local machine sets this to the remote cloud server url.
const CLOUD_SYNC_URL = process.env.CLOUD_SYNC_URL || "https://eat-n-repeat-cloud.example.com/api/sync/push";
const SYNC_INTERVAL_MS = 30000; // Check every 30 seconds

let syncTimer: NodeJS.Timeout | null = null;

export function startSyncWorker() {
  if (syncTimer) return;
  
  console.log(`[Sync Worker] Starting local-to-cloud sync worker...`);
  syncTimer = setInterval(async () => {
    try {
      // 1. Detect if we have true internet connection by resolving a reliable domain
      await dns.resolve("google.com");

      // 2. We have internet. Fetch pending records.
      const pool = getPool();
      const [orders] = await pool.execute<any[]>("SELECT * FROM orders WHERE sync_status = 'pending'");
      const [payments] = await pool.execute<any[]>("SELECT * FROM payments WHERE sync_status = 'pending'");
      const [customers] = await pool.execute<any[]>("SELECT * FROM customers WHERE sync_status = 'pending'");
      const [staff_notifications] = await pool.execute<any[]>("SELECT * FROM staff_notifications WHERE sync_status = 'pending'");

      if (orders.length === 0 && payments.length === 0 && customers.length === 0 && staff_notifications.length === 0) {
        return; // Nothing to sync
      }

      console.log(`[Sync Worker] Found pending records. Pushing to Cloud...`);

      // 3. Push to Cloud Backend
      const payload = {
        orders,
        payments,
        customers,
        staff_notifications
      };

      const res = await fetch(CLOUD_SYNC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        console.log(`[Sync Worker] Push successful. Marking records as synced.`);
        // 4. Mark as synced locally
        const markSynced = async (table: string, ids: string[]) => {
          if (ids.length === 0) return;
          const placeholders = ids.map(() => '?').join(',');
          await pool.execute(`UPDATE ${table} SET sync_status = 'synced' WHERE id IN (${placeholders})`, ids);
        };

        await markSynced("orders", orders.map(o => o.id));
        await markSynced("payments", payments.map(p => p.id));
        await markSynced("customers", customers.map(c => c.id));
        await markSynced("staff_notifications", staff_notifications.map(n => n.id));
      } else {
        console.error(`[Sync Worker] Cloud sync endpoint returned error: ${res.statusText}`);
      }

    } catch (err) {
      // Offline or network error, ignore and try again next interval.
    }
  }, SYNC_INTERVAL_MS);
}
