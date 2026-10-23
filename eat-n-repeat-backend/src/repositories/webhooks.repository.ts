import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export class WebhooksRepository {
  // Match by the invoice external id (order number) OR the stored invoice id.
  // Checkout stores the invoice URL in xenditReference, while Xendit webhook
  // payloads provide external_id (order number) + id (invoice id); the OR
  // keeps legacy callers working while resolving real invoice events.
  async findPaymentByXenditReference(referenceId: string, invoiceId?: string) {
    return prisma.payment.findFirst({
      where: {
        OR: [
          { xenditReference: referenceId },
          ...(invoiceId ? [{ xenditInvoiceId: invoiceId }] : []),
        ],
      },
      select: { id: true, orderId: true, status: true, amount: true, xenditInvoiceId: true, xenditReference: true },
    });
  }

  async updatePaymentStatus(
    paymentId: string,
    status: string,
    paidAt: Date | null,
  ) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: { status, paidAt },
    });
  }

  // ---------------------------------------------------------------------------
  // Orders
  // ---------------------------------------------------------------------------

  async findOrderById(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
    });
  }

  async findOrderStatusAndType(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, type: true, total: true },
    });
  }

  async updateOrderStatus(orderId: string, status: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
  }
}

export const webhooksRepository = new WebhooksRepository();
