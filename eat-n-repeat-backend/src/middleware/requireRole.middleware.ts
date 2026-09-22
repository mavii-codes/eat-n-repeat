import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "@/config/env";
import { authRepository } from "@/repositories/auth.repository";
import { customerSettingsRepository } from "@/repositories/customer-settings.repository";
import type { AuthenticatedRequest } from "./auth.middleware";

/**
 * Roles allowed on staff-operated endpoints. Customers are NEVER included:
 * a customer JWT must not pass these gates.
 */
export const STAFF_ROLES = ["admin", "head_staff", "staff"] as const;

export type RoleAuthedRequest = AuthenticatedRequest & {
  auth: { userId: string; role: string };
};

/**
 * requireRole(...roles) — authentication + DB-backed role authorization.
 *
 * 1. Verifies the Bearer JWT (same secret/rules as requireAuth).
 * 2. Resolves the role: users table first, then customers table
 *    (customer JWTs carry no role claim, so "customer" is inferred).
 *    Unknown subject in both tables -> 401.
 * 3. Rejects roles outside the allowed list -> 403.
 */
export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return res.status(401).json({ message: "Authentication required." });
    }

    try {
      const payload = jwt.verify(token, env.jwtSecret);
      if (!payload || typeof payload === "string" || !payload.sub) {
        return res.status(401).json({ message: "Invalid token." });
      }
      const userId = payload.sub as string;

      let role: string | null = null;
      const user = await authRepository.findUserById(userId);
      if (user?.role) {
        role = user.role;
      } else {
        const customer = await customerSettingsRepository.findCustomerById(userId);
        if (customer) role = "customer";
      }

      if (!role) {
        return res.status(401).json({ message: "Invalid token." });
      }
      if (!roles.includes(role)) {
        return res.status(403).json({ message: "Forbidden for this role." });
      }

      (req as RoleAuthedRequest).auth = { userId, role };
      next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired token." });
    }
  };
}
