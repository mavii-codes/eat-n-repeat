import { getCustomerOrdersService } from "./get-customer-orders";
import { cancelCustomerOrderService } from "./cancel-customer-order";

export async function getCustomerOrders(customerId: string) {
  return getCustomerOrdersService.execute(customerId);
}

export async function cancelCustomerOrder(orderId: string, customerId: string) {
  return cancelCustomerOrderService.execute(orderId, customerId);
}
