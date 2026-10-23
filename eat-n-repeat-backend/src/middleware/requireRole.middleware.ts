import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import {
  isIdentitySessionAllowed,
  resolveAuthIdentity,
  type AuthIdentity,
} from "@/middleware/security/auth-identity";
import { logBlockedAttempt } from "@/middleware/security/blocked-attempts";
import { enforcePendingPasswordChange } from "@/middleware/security/password-change-gate";
import { isTokenRevoked } from "@/middleware/security/token-revocations";
import {
  SESSION_EXPIRED_MESSAGE,
  type AuthenticatedRequest,
} from "./auth.middleware";

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
 * 2. Enforces token revocation and account status (active staff, archived /
 *    inactive staff rejected, disabled customers rejected).
 * 3. Resolves the role from the same identity lookup as requireAuth:
 *    users table first (DB role), then customers table ("customer").
 *    Unknown subject in both tables -> 401.
 * 4. Rejects roles outside the allowed list -> 403. Admins pass every gate.
 */
export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Same token sourcing as requireAuth: Authorization header first, then
    // `?token=` query parameter (query is required for SSE, since
    // EventSource cannot set custom headers).
    const headerToken = req.header("authorization")?.replace(/^Bearer\s+/i, "");
    const queryToken = req.query.token as string | undefined;
    const token = headerToken || queryToken;
    if (!token) {
      return res.status(401).json({ message: "Authentication required." });
    }

    let payload: jwt.JwtPayload;
    try {
      const verified = jwt.verify(token, env.jwtSecret);
      if (!verified || typeof verified === "string" || !verified.sub) {
        return res.status(401).json({ message: "Invalid token." });
      }
      payload = verified;
    } catch {
      return res.status(401).json({ message: "Invalid or expired token." });
    }

    const userId = String(payload.sub);
    const issuedAt = typeof payload.iat === "number" ? payload.iat : undefined;

    if (isTokenRevoked(userId, issuedAt)) {
      logBlockedAttempt("idp-forbidden", req.ip ?? null, "token_revoked", { userId });
      return res.status(401).json({ message: SESSION_EXPIRED_MESSAGE });
    }

    let identity: AuthIdentity | null;
    try {
      identity = await resolveAuthIdentity(prisma, userId);
    } catch (error) {
      console.error("Role identity lookup failed:", error);
      return res
        .status(503)
        .json({ message: "Authentication temporarily unavailable." });
    }

    if (!identity) {
      logBlockedAttempt("idp-forbidden", req.ip ?? null, "unknown_subject", { userId });
      return res.status(401).json({ message: "Invalid token." });
    }

    if (!isIdentitySessionAllowed(identity)) {
      logBlockedAttempt(
        "idp-forbidden",
        req.ip ?? null,
        identity.kind === "user"
          ? "staff_account_inactive_or_archived"
          : "customer_account_disabled",
        { userId },
      );
      return res.status(401).json({ message: SESSION_EXPIRED_MESSAGE });
    }

    // Forced first-login password change applies before role resolution so a
    // pending-change staff token cannot reach any staff-gated endpoint.
    const passwordGate = await enforcePendingPasswordChange(
      prisma,
      identity,
      req.originalUrl || req.path,
    );
    if (passwordGate === "unavailable") {
      return res
        .status(503)
        .json({ message: "Authentication temporarily unavailable." });
    }
    if (passwordGate === "block") {
      logBlockedAttempt(
        "idp-forbidden",
        req.ip ?? null,
        "must_change_password_gate",
        { userId },
      );
      return res.status(403).json({
        code: "MUST_CHANGE_PASSWORD",
        message: "Please change your temporary password first.",
      });
    }

    const role = identity.kind === "user" ? identity.user.role : "customer";

    // Admins are unrestricted; every other account must match the gate.
    if (role !== "admin" && !roles.includes(role)) {
      logBlockedAttempt("idp-forbidden", req.ip ?? null, "role_not_allowed", {
        userId,
        role,
        required: roles.join(","),
        path: req.originalUrl.split("?")[0] || req.path,
      });
      return res.status(403).json({ message: "Forbidden for this role." });
    }

    (req as RoleAuthedRequest).auth = {
      userId,
      kind: identity.kind,
      role,
    };
    next();
  };
}
