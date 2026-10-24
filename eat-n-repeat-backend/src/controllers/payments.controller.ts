import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import * as paymentsService from "@/services/payments";
import { PromoLimitError } from "@/services/promos/promos.service";
import { paymentsRepository } from "@/repositories/payments.repository";
import { logBlockedAttempt } from "@/middleware/security/blocked-attempts";

export class PaymentsController {
  async checkout(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.auth?.userId;
      const { orderDetails, paymentMethod, orderMode, cashReceived } = req.body;
      const safeOrderMode = orderMode === "local" ? "local" : "online";

      // Invariant: Customer checkout is strictly unavailable on the local backend.
      if (process.env.LOCAL_BACKEND === "true" || process.env.LOCAL_BACKEND === "1") {
        const isStaff = req.auth?.kind === "user" && (req.auth.role === "staff" || req.auth.role === "admin");
        if (!isStaff) {
          return res.status(503).json({
            success: false,
            message: "Online ordering is currently unavailable because there is no internet connection. Please place your order directly at the café.",
            error: "Online ordering is currently unavailable because there is no internet connection. Please place your order directly at the café.",
          });
        }
      }

      const result = await paymentsService.checkout(
        { orderDetails, paymentMethod, orderMode: safeOrderMode, cashReceived },
        customerId,
        { ip: req.ip ?? null, kind: req.auth?.kind ?? null }
      );

      const receipt = (result as any).receipt;

      if ((result as any).invoiceUrl) {
        return res.json({
          success: true,
          invoiceUrl: (result as any).invoiceUrl,
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          ...(receipt ? { receipt } : {}),
        });
      } else {
        return res.json({
          success: true,
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          ...(receipt ? { receipt } : {}),
        });
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);

      if (error instanceof paymentsService.ServiceError) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
          // Security caps are documented with `message`; keep `error` for the
          // existing customer cart which reads that field.
          ...(error.status === 429 ? { message: error.message } : {}),
        });
      }

      // A lost promo-usage race rolled the order back; respond with the
      // exact product copy the cart/POS surfaces verbatim (400, not 500).
      if (error instanceof PromoLimitError) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      // Tracked inventory insufficient stock (D1 enforcement)
      if (
        error?.name === "StockMovementError" ||
        error?.constructor?.name === "StockMovementError" ||
        (typeof error?.message === "string" && error.message.includes("Insufficient stock"))
      ) {
        return res.status(400).json({
          success: false,
          error: "Some items in your order are currently unavailable or have insufficient stock.",
        });
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

      // Customer tokens may only retry payments for their own orders.
      // Guest orders (customerId null) are staff-only. Staff/admin tokens
      // retain the existing unrestricted retry behavior.
      const auth = req.auth;
      if (auth?.kind === "customer") {
        const order = await paymentsRepository.findOrderByIdentifier(orderId);
        if (!order || order.customerId !== auth.userId) {
          logBlockedAttempt(
            "order-scrub",
            req.ip ?? null,
            "payment_retry_not_owned",
            { userId: auth.userId, orderId },
          );
          return res.status(403).json({
            success: false,
            error: "You do not have access to this order.",
          });
        }
      }

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
