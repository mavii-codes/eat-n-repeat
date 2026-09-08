import type { Response } from "express";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { DeliveryService } from "@/services/delivery";
import { createOrderSchema, statusSchema, personSchema, reassignSchema, cancelSchema } from "@/schema/delivery/delivery.schema";

export class DeliveryController {
  private service = new DeliveryService();

  async getOrders(_req: AuthenticatedRequest, res: Response) {
    try {
      const orders = await this.service.getDeliveryOrders();
      return res.json({ orders });
    } catch (error) {
      console.error("Error fetching delivery orders:", error);
      return res.status(500).json({ message: "Server error" });
    }
  }

  async createOrder(req: AuthenticatedRequest, res: Response) {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid delivery order details." });
    }

    try {
      const customerId = (req as any).auth?.userId;
      const order = await this.service.createDeliveryOrder(parsed.data, customerId);
      return res.status(201).json({ order });
    } catch (error: any) {
      if (error.status === 400) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Error creating delivery order:", error);
      return res.status(500).json({ message: "Server error" });
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response) {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid delivery status." });
    }
    const { status } = parsed.data;
    try {
      const order = await this.service.updateDeliveryOrderStatus(req.params.id as string, status);
      return res.json({ order });
    } catch (error: any) {
      if (error.status === 404) return res.status(404).json({ message: error.message });
      if (error.status === 400) return res.status(400).json({ message: error.message });
      console.error("Error updating delivery status:", error);
      return res.status(500).json({ message: "Server error" });
    }
  }

  async updatePerson(req: AuthenticatedRequest, res: Response) {
    const parsed = personSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid delivery person." });
    }
    const { deliveryPerson } = parsed.data;
    try {
      const order = await this.service.updateDeliveryPerson(req.params.id as string, deliveryPerson);
      return res.json({ order });
    } catch (error: any) {
      if (error.status === 404) return res.status(404).json({ message: error.message });
      console.error("Error updating delivery person:", error);
      return res.status(500).json({ message: "Server error" });
    }
  }

  async reassign(req: AuthenticatedRequest, res: Response) {
    const parsed = reassignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid reassignment payload." });
    }
    const { personId } = parsed.data;
    try {
      const result = await this.service.reassignDeliveryOrder(req.params.id as string, personId);
      return res.json(result);
    } catch (error: any) {
      if (error.status === 404) return res.status(404).json({ message: error.message });
      console.error("Error reassigning delivery order:", error);
      return res.status(500).json({ message: "Server error" });
    }
  }

  async cancel(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = cancelSchema.safeParse(req.body);
      const cancelledBy = parsed.success ? parsed.data.cancelledBy : "CUSTOMER";
      const formattedOrder = await this.service.cancelDeliveryOrder(req.params.id as string, cancelledBy);
      return res.json({ success: true, order: formattedOrder });
    } catch (error: any) {
      if (error.status === 404) return res.status(404).json({ message: error.message });
      if (error.status === 400) return res.status(400).json({ message: error.message });
      console.error("Error cancelling order:", error);
      return res.status(500).json({ message: "Failed to cancel order." });
    }
  }
}

export const deliveryController = new DeliveryController();
