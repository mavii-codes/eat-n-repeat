import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { adminCustomersRepository } from "@/repositories/admin-customers.repository";
import {
  normalizePhoneNumber,
  isValidPhoneNumber,
  phoneFormatMessage,
} from "@/services/customer-phone";
import { writeActivity } from "@/services/admin-users/activity";

function serviceError(statusCode: number, message: string) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export class AdminCustomersService {
  async listCustomers(search = "", page = 1, limit = 20) {
    const p = Math.max(1, Math.floor(page) || 1);
    const l = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const { rows, total } = await adminCustomersRepository.listCustomers(search, p, l);
    return {
      customers: rows.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages: Math.max(1, Math.ceil(total / l)),
      },
    };
  }

  /**
   * Admin-only mobile change (SIM swaps, typos). Runs the profile update
   * and the audit entry in ONE transaction. Phone uniqueness is
   * deliberately NOT enforced (the project never enforced it).
   */
  async updateCustomerPhone(
    customerId: string,
    rawPhone: unknown,
    admin: { id: string; name: string },
  ) {
    const phone = normalizePhoneNumber(rawPhone);
    if (!isValidPhoneNumber(phone)) {
      throw serviceError(400, phoneFormatMessage());
    }
    const customer = await adminCustomersRepository.findCustomerById(customerId);
    if (!customer) {
      throw serviceError(404, "Customer not found.");
    }
    const oldPhone = customer.phone;
    const { updated } = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: { phone },
        select: { id: true, name: true, email: true, phone: true },
      });
      await tx.customerPhoneChangeLog.create({
        data: {
          id: `pcl-${crypto.randomUUID().slice(0, 8)}`,
          customerId,
          customerEmail: customer.email,
          oldPhone,
          newPhone: phone,
          changedBy: admin.id,
          changedByName: admin.name,
        },
      });
      // Phase 2 unified admin audit trail (existing response contract intact).
      await writeActivity(
        {
          actorId: admin.id,
          actorName: admin.name,
          action: "customer_phone_edited",
          targetType: "customer",
          targetId: customerId,
          targetName: customer.name,
          meta: { from: oldPhone, to: phone },
        },
        tx,
      );
      return { updated };
    });
    return {
      customer: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
      },
    };
  }
}

export const adminCustomersService = new AdminCustomersService();
