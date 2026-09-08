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
}

export const customerOrdersController = new CustomerOrdersController();
