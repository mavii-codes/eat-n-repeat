import { customerOrdersRepository } from "@/repositories/customer-orders.repository";

export class GetCustomerOrdersService {
  async execute(customerId: string) {
    const orders = await customerOrdersRepository.findOrdersByCustomerId(customerId);

    return orders.map((o) => {
      const payment = o.payments[0] ?? null;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        orderedAt: o.createdAt,
        status: o.status,
        type: o.type,
        total: Number(o.total),
        subtotal: Number(o.subtotal),
        deliveryFee: Number(o.deliveryFee),
        discount: 0,
        paymentMethod: payment?.paymentMethod ?? null,
        paymentStatus: payment?.status ?? null,
        customerName: o.customerName,
        phone: o.phone,
        address: o.address,
        items: o.items,
        specialInstructions: null,
        estimatedDeliveryTime: o.estimatedDeliveryTime,
        deliveryPerson: o.deliveryPerson,
        assignedRole: o.assignedRole,
        assignedAt: o.assignedAt,
        cancelledBy: o.cancelledBy,
        cancelledAt: o.cancelledAt,
        xenditInvoiceId: payment?.xenditInvoiceId ?? null,
        xenditReference: payment?.xenditReference ?? null,
      };
    });
  }
}

export const getCustomerOrdersService = new GetCustomerOrdersService();
