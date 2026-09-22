import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export class WebhooksRepository {
  async findPaymentByXenditReference(referenceId: string) {
    return prisma.payment.findFirst({
      where: { xenditReference: referenceId },
      select: { id: true, orderId: true, status: true, amount: true, xenditInvoiceId: true },
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
