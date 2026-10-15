import { prisma } from "@/lib/prisma";

export class CashRepository {
  async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async findUserRole(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
  }

  async findUserName(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
  }

  async findOpenShiftByStaffId(staffId: string) {
    return prisma.cashShift.findFirst({
      where: { staffId, status: "open" },
      orderBy: { startTime: "desc" },
    });
  }

  async findOpenShiftByIdAndStaff(shiftId: string, staffId: string) {
    return prisma.cashShift.findFirst({
      where: { id: shiftId, staffId, status: "open" },
    });
  }

  async findOpenShiftById(shiftId: string) {
    return prisma.cashShift.findFirst({
      where: { id: shiftId, status: "open" },
    });
  }

  async findAnyOpenShift() {
    return prisma.cashShift.findFirst({
      where: { status: "open" },
      orderBy: { startTime: "desc" },
    });
  }

  async createShift(data: {
    id: string;
    staffId: string;
    staffName: string;
    startingFloat: number;
    expectedCash: number;
    status: string;
    startTime: Date;
  }) {
    return prisma.cashShift.create({ data });
  }

  async updateShift(shiftId: string, data: any) {
    return prisma.cashShift.update({
      where: { id: shiftId },
      data,
    });
  }

  async findAllShifts() {
    return prisma.cashShift.findMany({
      orderBy: { startTime: "desc" },
    });
  }

  async findShiftById(shiftId: string) {
    return prisma.cashShift.findUnique({
      where: { id: shiftId },
    });
  }

  async findTransactionsByShiftId(shiftId: string) {
    return prisma.cashTransaction.findMany({
      where: { shiftId },
      orderBy: { timestamp: "desc" },
    });
  }

  /**
   * Drawer sales split for the X-read: cash sales move physical money,
   * GCash sales never do. Float adjustments are excluded from both.
   */
  async sumShiftSales(shiftId: string): Promise<{ cash_sales: number; gcash_sales: number }> {
    const rows = await prisma.cashTransaction.findMany({
      where: { shiftId },
      select: { type: true, amount: true },
    });
    let cash = 0;
    let gcash = 0;
    for (const r of rows) {
      const amount = Number(r.amount) || 0;
      if (r.type === "sale") cash += amount;
      else if (r.type === "gcash_sale") gcash += amount;
    }
    return { cash_sales: cash, gcash_sales: gcash };
  }

  async findCashTransactionByOrderId(orderId: string) {
    return prisma.cashTransaction.findFirst({
      where: { orderId },
    });
  }

  async createTransaction(data: {
    id: string;
    shiftId: string;
    type: string;
    amount: number;
    adminId: string;
    adminName: string;
    reason: string;
    timestamp: Date;
    orderId?: string | null;
  }) {
    return prisma.cashTransaction.create({
      data: {
        id: data.id,
        shiftId: data.shiftId,
        type: data.type,
        amount: data.amount,
        adminId: data.adminId,
        adminName: data.adminName,
        reason: data.reason,
        timestamp: data.timestamp,
        orderId: data.orderId ?? null,
      },
    });
  }
}

export const cashRepository = new CashRepository();
