import type { PrismaClient } from "@prisma/client";
import type { AuthIdentity } from "./auth-identity";

/** Minimal Prisma surface needed to enforce the pending-password-change gate. */
export type PasswordChangeGateDb = Pick<PrismaClient, "user">;

export type PasswordChangeGateResult = "allow" | "block" | "unavailable";

/** Staff may only read their profile or complete the forced change itself. */
const EXEMPT_PREFIXES = [
  "/api/auth/me",
  "/api/auth/change-initial-password",
] as const;

/**
 * Enforces the forced first-login password change for staff identities.
 *
 * Returns "allow" for customers / staff without a pending change (and for
 * the two exempt auth endpoints), "block" when the request must be rejected,
 * or "unavailable" when the flag lookup failed (callers fail closed with 503).
 */
export async function enforcePendingPasswordChange(
  db: PasswordChangeGateDb,
  identity: AuthIdentity,
  originalUrl: string,
): Promise<PasswordChangeGateResult> {
  if (identity.kind !== "user") return "allow";

  try {
    const account = await db.user.findUnique({
      where: { id: identity.user.id },
      select: { mustChangePassword: true },
    });
    if (account?.mustChangePassword !== true) return "allow";

    const exempt = EXEMPT_PREFIXES.some((prefix) =>
      originalUrl.startsWith(prefix),
    );
    return exempt ? "allow" : "block";
  } catch (error) {
    console.error("Password-change gate lookup failed:", error);
    return "unavailable";
  }
}
