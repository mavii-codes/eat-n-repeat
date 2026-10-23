import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { adminUsersService } from "@/services/admin-users/index";

function serviceError(res: Response, error: unknown, context: string) {
  const statusCode = (error as { statusCode?: number })?.statusCode;
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({ message: (error as Error).message });
  }
  console.error(`Error ${context}:`, error);
  return res.status(500).json({ message: "Internal server error." });
}

function actorId(req: AuthenticatedRequest): string {
  return req.auth?.userId ?? "";
}

/** Express parses repeated query params as arrays; take the first string. */
function queryString(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first : undefined;
}

export class AdminUsersController {
  async listStaff(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await adminUsersService.listStaff({
        search: queryString(req.query.search) ?? "",
        role: queryString(req.query.role),
        status: queryString(req.query.status),
        sort: queryString(req.query.sort),
        dir: queryString(req.query.dir),
        page: Number(queryString(req.query.page)) || 1,
        limit: Number(queryString(req.query.limit)) || 20,
      });
      return res.json(result);
    } catch (error) {
      return serviceError(res, error, "listing staff accounts");
    }
  }

  async listCustomers(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await adminUsersService.listCustomers({
        search: queryString(req.query.search) ?? "",
        status: queryString(req.query.status),
        sort: queryString(req.query.sort),
        dir: queryString(req.query.dir),
        page: Number(queryString(req.query.page)) || 1,
        limit: Number(queryString(req.query.limit)) || 20,
      });
      return res.json(result);
    } catch (error) {
      return serviceError(res, error, "listing customer accounts");
    }
  }

  async listActivity(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await adminUsersService.listActivity({
        action: queryString(req.query.action),
        targetType: queryString(req.query.targetType),
        search: queryString(req.query.search) ?? "",
        from: queryString(req.query.from),
        to: queryString(req.query.to),
        page: Number(queryString(req.query.page)) || 1,
        limit: Number(queryString(req.query.limit)) || 20,
      });
      return res.json(result);
    } catch (error) {
      return serviceError(res, error, "listing activity");
    }
  }

  async disableStaff(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await adminUsersService.disableStaff(
        req.params.id as string,
        actorId(req),
      );
      return res.json(result);
    } catch (error) {
      return serviceError(res, error, "disabling staff account");
    }
  }

  async enableStaff(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await adminUsersService.enableStaff(
        req.params.id as string,
        actorId(req),
      );
      return res.json(result);
    } catch (error) {
      return serviceError(res, error, "enabling staff account");
    }
  }

  async resetStaffPassword(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await adminUsersService.resetStaffPassword(
        req.params.id as string,
        actorId(req),
      );
      return res.json(result);
    } catch (error) {
      return serviceError(res, error, "resetting staff password");
    }
  }

  async disableCustomer(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await adminUsersService.disableCustomer(
        req.params.id as string,
        actorId(req),
      );
      return res.json(result);
    } catch (error) {
      return serviceError(res, error, "disabling customer account");
    }
  }

  async enableCustomer(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await adminUsersService.enableCustomer(
        req.params.id as string,
        actorId(req),
      );
      return res.json(result);
    } catch (error) {
      return serviceError(res, error, "enabling customer account");
    }
  }
}

export const adminUsersController = new AdminUsersController();
