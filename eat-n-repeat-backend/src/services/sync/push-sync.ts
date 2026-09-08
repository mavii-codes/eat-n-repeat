import { syncRepository } from "@/repositories/sync.repository";

export class PushSyncService {
  async execute(data: {
    orders?: any[];
    payments?: any[];
    customers?: any[];
    staff_notifications?: any[];
  }) {
    const { orders, payments, customers, staff_notifications } = data;

    // Sync Customers
    if (customers && customers.length > 0) {
      await syncRepository.upsertCustomers(customers);
    }

    // Sync Orders
    if (orders && orders.length > 0) {
      await syncRepository.upsertOrders(orders);
    }

    // Sync Payments
    if (payments && payments.length > 0) {
      await syncRepository.upsertPayments(payments);
    }

    // Sync Staff Notifications
    if (staff_notifications && staff_notifications.length > 0) {
      await syncRepository.upsertStaffNotifications(staff_notifications);
    }
  }
}

export const pushSyncService = new PushSyncService();
