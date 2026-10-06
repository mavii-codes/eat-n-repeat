import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import * as service from "@/services/customer-orders";

export class CustomerOrdersController {
  async getCustomerOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.auth?.userId;
      if (!customerId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
      const orders = await service.getCustomerOrders(customerId);
      res.json({ success: true, orders });
    } catch (error) {
      console.error("Error fetching customer orders:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async cancelOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.auth?.userId;
      if (!customerId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
      const order = await service.cancelCustomerOrder(req.params.id as string, customerId);
      res.json({ success: true, message: "Order cancelled", orderNumber: order.orderNumber });
    } catch (error: any) {
      if (error.status === 404) return res.status(404).json({ success: false, message: error.message });
      if (error.status === 400) return res.status(400).json({ success: false, message: error.message });
      console.error("Error cancelling customer order:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
}

export const customerOrdersController = new CustomerOrdersController();
