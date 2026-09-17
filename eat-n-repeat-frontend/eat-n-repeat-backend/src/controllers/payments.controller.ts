import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import * as paymentsService from "@/services/payments";

export class PaymentsController {
  async checkout(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.auth?.userId;
      const { orderDetails, paymentMethod, orderMode } = req.body;
      const safeOrderMode = orderMode === "local" ? "local" : "online";

      const result = await paymentsService.checkout({ orderDetails, paymentMethod, orderMode: safeOrderMode }, customerId);

      if ((result as any).invoiceUrl) {
        return res.json({
          success: true,
          invoiceUrl: (result as any).invoiceUrl,
          orderId: result.orderId,
          orderNumber: result.orderNumber,
        });
      } else {
        return res.json({ success: true, orderId: result.orderId, orderNumber: result.orderNumber });
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);

      if (error instanceof paymentsService.ServiceError) {
        return res.status(error.status).json({ success: false, error: error.message });
      }

      // Extract Xendit-specific error details if present
      let errorMsg = error.message || "Failed to process checkout";
      if (error.response && error.response.data) {
        errorMsg = JSON.stringify(error.response.data);
      } else if (error.stack) {
        errorMsg = String(error);
      }

      res.status(500).json({ success: false, error: errorMsg });
    }
  }

  async getPayment(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId as string;

      const payment = await paymentsService.getPaymentByOrderId(orderId);

      if (!payment) {
        return res.status(404).json({ success: false, message: "No payment record found." });
      }

      return res.json({
        success: true,
        payment,
      });
    } catch (error) {
      console.error("Error fetching order payment details:", error);
      res.status(500).json({ success: false, message: "Failed to fetch payment details" });
    }
  }

  async retry(req: AuthenticatedRequest, res: Response) {
    try {
      const orderId = req.params.orderId as string;

      const result = await paymentsService.retryPayment(orderId);

      return res.json({ success: true, invoiceUrl: result.invoiceUrl, orderId: result.orderId, orderNumber: result.orderNumber });
    } catch (error: any) {
      console.error("Error retrying payment:", error);
      if (error instanceof paymentsService.ServiceError) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: "Failed to create retry payment" });
    }
  }
}

export const paymentsController = new PaymentsController();
