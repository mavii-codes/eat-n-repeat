import { deliveryRepository } from "@/repositories/delivery.repository";
import { notifyAllStaff } from "@/services/staff-notifications";

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DLV-${timestamp}-${random}`;
}

export class DeliveryService {
  async getDeliveryOrders() {
    const orders = await deliveryRepository.findDeliveryOrders();
    return orders.map((order: any) => ({
      ...order,
      items: typeof order.items === "string" ? JSON.parse(order.items) : order.items,
    }));
  }

  async createDeliveryOrder(data: any, customerId?: string) {
    const { customerName, phone, address, serviceAreaId, items, deliveryFee, notes, estimatedDeliveryTime } = data;

    // Validate and fetch addons
    const addonIds = items
      .filter((item: any) => item.type === "addon")
      .map((item: any) => item.id);

    let addons: any[] = [];
    if (addonIds.length > 0) {
      addons = await deliveryRepository.findAddonsByIds(addonIds);
    }

    // Calculate subtotal
    let subtotal = 0;
    const processedItems = items.map((item: any) => {
      if (item.type === "addon") {
        const addon = addons.find((a: any) => a.id === item.id);
        if (addon) {
          subtotal += addon.price * (item.quantity || 1);
          return { ...item, name: addon.name, price: addon.price };
        }
      } else {
        subtotal += (item.price || 0) * (item.quantity || 1);
        return item;
      }
      return item;
    });

    const total = subtotal + (deliveryFee || 0);
    const orderId = crypto.randomUUID();
    const orderNumber = generateOrderNumber();

    const order = await deliveryRepository.createOrder({
      id: orderId,
      orderNumber,
      customerId: customerId || null,
      customerName,
      phone: phone || null,
      address,
      serviceAreaId: serviceAreaId || null,
      type: "delivery",
      items: JSON.stringify(processedItems),
      subtotal,
      deliveryFee: deliveryFee || 0,
      total,
      status: "pending",
      deliveryPerson: "",
      assignedRole: "",
      assignedAt: new Date(),
      estimatedDeliveryTime: estimatedDeliveryTime || "",
      notes: notes || null,
      createdAt: new Date(),
      pendingAt: new Date(),
      archived: false,
    });

    // Notify staff
    await notifyAllStaff(
      "delivery",
      "NEW DELIVERY ORDER",
      `Order #${orderNumber}\nCustomer: ${customerName}\nAmount: ₱${total.toFixed(2)}\nAddress: ${address}`,
      order.id
    );

    // Order event emitted via SSE

    return { ...order, items: processedItems };
  }

  async updateDeliveryOrderStatus(orderId: string, status: string) {
    const order = await deliveryRepository.findOrderByIdWithPayments(orderId);
    if (!order) {
      throw Object.assign(new Error("Order not found"), { status: 404 });
    }

    const validTransitions: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["preparing", "cancelled"],
      preparing: ["out_for_delivery", "cancelled"],
      out_for_delivery: ["delivered", "cancelled"],
      delivered: ["completed"],
      pending_payment: ["confirmed", "cancelled"],
      awaiting_payment: ["confirmed", "cancelled"],
    };

    if (order.status === "cancelled") {
      throw Object.assign(new Error("Cannot update a cancelled order"), { status: 400 });
    }

    if (order.status === "completed") {
      throw Object.assign(new Error("Cannot update a completed order"), { status: 400 });
    }

    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(status)) {
      throw Object.assign(
        new Error(`Cannot transition from ${order.status} to ${status}`),
        { status: 400 }
      );
    }

    const updatedOrder = await deliveryRepository.updateOrder(orderId, { status });

    return updatedOrder;
  }

  async updateDeliveryPerson(orderId: string, deliveryPerson: string) {
    const order = await deliveryRepository.findOrderByIdWithPayments(orderId);
    if (!order) {
      throw Object.assign(new Error("Order not found"), { status: 404 });
    }

    const updatedOrder = await deliveryRepository.updateOrder(orderId, {
      deliveryPerson,
      assignedAt: new Date(),
    });

    return updatedOrder;
  }

  async reassignDeliveryOrder(orderId: string, personId: string) {
    const order = await deliveryRepository.findOrderByIdOrNumber(orderId);
    if (!order) {
      throw Object.assign(new Error("Order not found"), { status: 404 });
    }

    const updatedOrder = await deliveryRepository.updateOrder(order.id, {
      deliveryPerson: personId,
      assignedAt: new Date(),
    });

    // Order event emitted via SSE

    return { success: true, order: updatedOrder };
  }

  async cancelDeliveryOrder(orderId: string, cancelledBy: string = "CUSTOMER") {
    const order = await deliveryRepository.findOrderByIdOrNumber(orderId);
    if (!order) {
      throw Object.assign(new Error("Order not found"), { status: 404 });
    }

    if (order.status === "cancelled") {
      throw Object.assign(new Error("Order is already cancelled"), { status: 400 });
    }

    const updatedOrder = await deliveryRepository.updateOrder(order.id, {
      status: "cancelled",
      cancelledBy,
    });

    // Order event emitted via SSE

    return updatedOrder;
  }
}
