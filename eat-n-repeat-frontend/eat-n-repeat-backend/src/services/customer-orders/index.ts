import { getCustomerOrdersService } from "./get-customer-orders";

export async function getCustomerOrders(customerId: string) {
  return getCustomerOrdersService.execute(customerId);
}
