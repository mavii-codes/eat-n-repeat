import { prisma } from "@/lib/prisma";
import { comparePassword, hashPassword } from "@/lib/bcrypt";
import { assertPasswordPolicy } from "@/middleware/security/password-policy";
import { revokeAllForUser } from "@/middleware/security/token-revocations";
import { writeActivity } from "@/services/admin-users/activity";

function serviceError(statusCode: number, message: string) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Forced first-login password change for staff accounts. Verifying the
 * current password prevents a stolen/forced token from silently taking over
 * the account. Revoking tokens after the update invalidates the caller's own
 * token too, so the client must sign in again with the new password.
 */
export class ChangeInitialPasswordService {
  async execute(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, passwordHash: true },
    });
    if (!user) {
      throw serviceError(401, "Session is no longer valid.");
    }

    if (!(await comparePassword(currentPassword, user.passwordHash))) {
      throw serviceError(400, "Current password is incorrect.");
    }

    const policyError = assertPasswordPolicy(newPassword);
    if (policyError) {
      throw serviceError(400, policyError);
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
      select: { id: true },
    });
    revokeAllForUser(userId);

    await writeActivity({
      actorId: userId,
      actorName: user.name,
      action: "initial_password_change",
      targetType: "staff",
      targetId: userId,
      targetName: user.name,
      meta: { mustChangePassword: false },
    });

    return { message: "Password updated. Please sign in again." };
  }
}

export const changeInitialPasswordService = new ChangeInitialPasswordService();
