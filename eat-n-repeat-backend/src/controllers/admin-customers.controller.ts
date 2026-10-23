import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { prisma } from "@/lib/prisma";
import { adminCustomersService } from "@/services/admin-customers/index";

function dbError(res: Response, error: unknown, context: string) {
  const statusCode = (error as { statusCode?: number })?.statusCode;
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({ message: (error as Error).message });
  }
  console.error(`Error ${context}:`, error);
  return res.status(500).json({ message: "Internal server error." });
}

async function resolveAdminName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  return user?.name?.trim() || "Admin";
}

export class AdminCustomersController {
  async listCustomers(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await adminCustomersService.listCustomers(
        (req.query.search as string | undefined) ?? "",
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      return res.json(result);
    } catch (error) {
      return dbError(res, error, "listing customers");
    }
  }

  async updateCustomerPhone(req: AuthenticatedRequest, res: Response) {
    try {
      const adminId = req.auth!.userId;
      const result = await adminCustomersService.updateCustomerPhone(
        req.params.id as string,
        (req.body as { phone?: unknown })?.phone,
        { id: adminId, name: await resolveAdminName(adminId) },
      );
      return res.json(result);
    } catch (error) {
      return dbError(res, error, "updating customer phone");
    }
  }
}

export const adminCustomersController = new AdminCustomersController();
