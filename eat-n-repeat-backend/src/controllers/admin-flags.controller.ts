import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { adminFlagsService } from "@/services/admin-flags";

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

export class AdminFlagsController {
  async reportCustomer(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await adminFlagsService.reportCustomer(
        req.params.id as string,
        actorId(req),
        (req.body as { reason?: unknown } | undefined)?.reason,
      );
      return res.json(result);
    } catch (error) {
      return serviceError(res, error, "reporting customer");
    }
  }

  async listFlags(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await adminFlagsService.listFlags({
        status: queryString(req.query.status) as
          | "open"
          | "dismissed"
          | "all"
          | undefined,
        outcome: queryString(req.query.outcome),
        search: queryString(req.query.search) ?? "",
        page: Number(queryString(req.query.page)) || 1,
        limit: Number(queryString(req.query.limit)) || 20,
      });
      return res.json(result);
    } catch (error) {
      return serviceError(res, error, "listing customer flags");
    }
  }

  async openCount(_req: AuthenticatedRequest, res: Response) {
    try {
      return res.json(await adminFlagsService.countOpenFlags());
    } catch (error) {
      return serviceError(res, error, "counting open flags");
    }
  }

  async approve(req: AuthenticatedRequest, res: Response) {
    try {
      return res.json(
        await adminFlagsService.approveFlag(
          req.params.id as string,
          actorId(req),
        ),
      );
    } catch (error) {
      return serviceError(res, error, "approving flag");
    }
  }

  async dismiss(req: AuthenticatedRequest, res: Response) {
    try {
      return res.json(
        await adminFlagsService.dismissFlag(
          req.params.id as string,
          actorId(req),
        ),
      );
    } catch (error) {
      return serviceError(res, error, "dismissing flag");
    }
  }

  async watch(req: AuthenticatedRequest, res: Response) {
    try {
      return res.json(
        await adminFlagsService.watchFlag(
          req.params.id as string,
          actorId(req),
        ),
      );
    } catch (error) {
      return serviceError(res, error, "setting flag to keep watching");
    }
  }
}

export const adminFlagsController = new AdminFlagsController();
