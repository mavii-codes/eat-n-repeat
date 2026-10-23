import crypto from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Minimal Prisma surface needed by the activity writer (tx-compatible). */
export type ActivityDb = Pick<PrismaClient, "user" | "userActivityLog">;

export type WriteActivityInput = {
  actorId: string;
  /** Optional: resolved from `users` when omitted. */
  actorName?: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetName?: string | null;
  meta?: Prisma.InputJsonValue | null;
};

/**
 * Resolves the display name of the authenticated actor from the `users`
 * table. Falls back to "Admin" for a missing/blank name so audit rows are
 * never rendered nameless.
 */
export async function resolveActorName(
  actorId: string,
  db: ActivityDb = prisma,
): Promise<string> {
  if (!actorId) return "Admin";
  const user = await db.user.findUnique({
    where: { id: actorId },
    select: { name: true },
  });
  return user?.name?.trim() || "Admin";
}

/**
 * Appends one audit row to `user_activity_logs`. Never pass secrets here:
 * password-reset callers must log only metadata, never the temporary password.
 */
export async function writeActivity(
  input: WriteActivityInput,
  db: ActivityDb = prisma,
): Promise<void> {
  const actorName =
    input.actorName?.trim() || (await resolveActorName(input.actorId, db));

  await db.userActivityLog.create({
    data: {
      id: `act-${crypto.randomUUID()}`,
      actorId: input.actorId,
      actorName,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      targetName: input.targetName ?? null,
      ...(input.meta == null ? {} : { meta: input.meta }),
    },
  });
}
