import type { PrismaClient } from "@prisma/client";

/**
 * Minimal Prisma surface needed to resolve an authenticated JWT subject.
 * Both the root client and a `prisma.$transaction` client satisfy this.
 */
export type AuthIdentityDb = Pick<PrismaClient, "user" | "customer">;

export type UserAuthIdentity = {
  kind: "user";
  user: {
    id: string;
    name: string;
    status: string;
    archived: boolean;
    role: string;
  };
};

export type CustomerAuthIdentity = {
  kind: "customer";
  customer: {
    id: string;
    status: string;
  };
};

export type AuthIdentity = UserAuthIdentity | CustomerAuthIdentity;

/**
 * Resolves a JWT subject to the staff `users` row first, then the `customers`
 * row. Returns null when the subject exists in neither table (deleted /
 * unknown account). Only identity fields required by auth middleware and
 * authorization checks are selected.
 */
export async function resolveAuthIdentity(
  db: AuthIdentityDb,
  userId: string,
): Promise<AuthIdentity | null> {
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      status: true,
      archived: true,
      role: true,
    },
  });

  if (user) {
    return { kind: "user", user };
  }

  const customer = await db.customer.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  if (customer) {
    return { kind: "customer", customer };
  }

  return null;
}

/** True when the resolved account is allowed to use existing sessions. */
export function isIdentitySessionAllowed(identity: AuthIdentity): boolean {
  if (identity.kind === "user") {
    return identity.user.status === "active" && !identity.user.archived;
  }
  return identity.customer.status !== "disabled";
}
