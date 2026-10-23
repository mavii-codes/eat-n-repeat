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

export const SESSION_EXPIRED_MESSAGE = "Session expired. Please sign in again.";

export type AuthKind = "user" | "customer";

export type AuthenticatedRequest = Request & {
  auth?: { userId: string; role?: string; kind?: AuthKind };
};

function readToken(req: Request): string | undefined {
  // Check Authorization header first, then query parameter (for SSE connections)
  const headerToken = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const queryToken = req.query.token as string | undefined;
  return headerToken || queryToken;
}

function readIssuedAt(payload: jwt.JwtPayload): number | undefined {
  return typeof payload.iat === "number" ? payload.iat : undefined;
}

/**
 * Applies the resolved account to `req.auth`. Returns false when the account
 * is no longer allowed to use sessions (disabled / archived / inactive).
 */
function attachIdentity(
  req: AuthenticatedRequest,
  userId: string,
  identity: AuthIdentity,
): boolean {
  if (!isIdentitySessionAllowed(identity)) return false;

  if (identity.kind === "user") {
    req.auth = {
      userId,
      kind: "user",
      role: identity.user.role,
    };
  } else {
    req.auth = {
      userId,
      kind: "customer",
      role: "customer",
    };
  }
  return true;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ message: "Authentication required." });

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

  if (isTokenRevoked(userId, readIssuedAt(payload))) {
    logBlockedAttempt("idp-forbidden", req.ip ?? null, "token_revoked", { userId });
    return res.status(401).json({ message: SESSION_EXPIRED_MESSAGE });
  }

  let identity: AuthIdentity | null;
  try {
    identity = await resolveAuthIdentity(prisma, userId);
  } catch (error) {
    console.error("Auth identity lookup failed:", error);
    return res
      .status(503)
      .json({ message: "Authentication temporarily unavailable." });
  }

  if (!identity) {
    logBlockedAttempt("idp-forbidden", req.ip ?? null, "unknown_subject", { userId });
    return res.status(401).json({ message: "Invalid token." });
  }

  if (!attachIdentity(req, userId, identity)) {
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

  // Forced first-login password change: staff can only read their profile or
  // complete the change itself until they replace the temporary password.
  // Customers are unaffected.
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

  next();
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  const token = readToken(req);
  if (!token) return next();

  try {
    const verified = jwt.verify(token, env.jwtSecret);
    if (!verified || typeof verified === "string" || !verified.sub) {
      return next();
    }

    const userId = String(verified.sub);

    // Revoked / inactive accounts simply continue as guests.
    if (isTokenRevoked(userId, readIssuedAt(verified))) {
      return next();
    }

    const identity = await resolveAuthIdentity(prisma, userId);
    if (!identity) return next();

    attachIdentity(req, userId, identity);
  } catch {
    // Any verification/lookup failure means unauthenticated, never a throw.
  }

  next();
}
