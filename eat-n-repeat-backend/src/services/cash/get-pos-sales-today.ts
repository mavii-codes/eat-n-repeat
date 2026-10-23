import { cashRepository } from "@/repositories/cash.repository";
import {
  buildPosReceipt,
  manilaDayRange,
  parseReceiptNote,
  type PosReceipt,
} from "@/lib/pos-receipt";

const ITEMS_SUMMARY_MAX = 160;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function summarizeItems(items: PosReceipt["items"]): string {
  const summary = items.map((item) => `${item.quantity}× ${item.name}`).join(", ");
  if (summary.length <= ITEMS_SUMMARY_MAX) return summary;
  return `${summary.slice(0, ITEMS_SUMMARY_MAX - 1).trimEnd()}…`;
}

/**
 * "Paid Today" feed: every POS cash/GCash sale recorded on the Asia/Manila
 * calendar day, joined to its order for the receipt snapshot. Cancelled/voided
 * orders are excluded. Staff see only their own sales; admins see all.
 */
export class GetPosSalesTodayService {
  async execute(userId: string, isAdmin: boolean) {
    const { start, end, date } = manilaDayRange();

    const txs = await cashRepository.findPosSalesToday({
      start,
      end,
      adminId: isAdmin ? undefined : userId,
    });

    const orderIds = [
      ...new Set(txs.map((tx) => tx.orderId).filter((id): id is string => Boolean(id))),
    ];
    const orders = await cashRepository.findOrdersByIds(orderIds);
    const orderMap = new Map(orders.map((order) => [order.id, order]));

    const sales: Array<PosReceipt & { itemsSummary: string }> = [];
    let totalCollected = 0;

    for (const tx of txs) {
      if (!tx.orderId) continue;
      const order = orderMap.get(tx.orderId);
      if (!order) continue;

      if (
        order.status === "cancelled" ||
        order.status === "voided" ||
        order.cancelledAt != null
      ) {
        continue;
      }

      const receipt = buildPosReceipt({
        order,
        cashier: tx.adminName || "Staff",
        paymentMethod: tx.type === "gcash_sale" ? "gcash" : "cash",
        ...parseReceiptNote(tx.reason),
      });

      sales.push({ ...receipt, itemsSummary: summarizeItems(receipt.items) });
      totalCollected += receipt.total;
    }

    return {
      date,
      timezone: "Asia/Manila",
      summary: {
        count: sales.length,
        totalCollected: round2(totalCollected),
      },
      sales,
    };
  }
}

export const getPosSalesTodayService = new GetPosSalesTodayService();
