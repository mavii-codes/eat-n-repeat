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

  async createTransaction(data: {
    id: string;
    shiftId: string;
    type: string;
    amount: number;
    adminId: string;
    adminName: string;
    reason: string;
    timestamp: Date;
  }) {
    return prisma.cashTransaction.create({ data });
  }
}

export const cashRepository = new CashRepository();
