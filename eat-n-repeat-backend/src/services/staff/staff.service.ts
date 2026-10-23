import { staffRepository } from "@/repositories/staff.repository";
import { hashPassword } from "@/lib/bcrypt";
import { assertPasswordPolicy } from "@/middleware/security/password-policy";
import { revokeUserTokensBeforeNow } from "@/middleware/security/token-revocations";

// A bcrypt hash must NEVER be hashed again: hashing hash(password) permanently
// locks the account (the original password stops verifying). This guard turns
// that silent corruption into a loud 400 for any caller.
const BCRYPT_HASH_RE = /^\$2[aby]\$/;

function assertPlaintextPassword(password: unknown) {
  if (typeof password === "string" && BCRYPT_HASH_RE.test(password)) {
    const err: any = new Error("Password must be plaintext, not a hash.");
    err.statusCode = 400;
    throw err;
  }
}

export async function getAllUsers() {
  return staffRepository.findAllUsers();
}

export async function findUserByEmail(email: string) {
  return staffRepository.findUserByEmail(email);
}

export async function findUserByUsername(username: string) {
  return staffRepository.findUserByUsername(username);
}

export async function findUserByIdRaw(id: string) {
  return staffRepository.findUserById(id);
}

export async function createUser(data: {
  name: string;
  username: string;
  email: string;
  password: string;
  role: string;
  status: string;
  archived?: boolean;
}) {
  const { v4: uuidv4 } = await import("uuid");
  assertPlaintextPassword(data.password);
  const passwordHash = await hashPassword(data.password);

  // mustChangePassword: true — whichever way the admin set the initial
  // password (typed or generated), the team member sets their own at first
  // sign-in, the same flow as an admin-triggered password reset.
  return staffRepository.createUser({
    id: uuidv4(),
    name: data.name,
    username: data.username,
    email: data.email,
    passwordHash,
    role: data.role,
    status: data.status,
    archived: data.archived ?? false,
    mustChangePassword: true,
  });
}

export async function updateUser(
  id: string,
  data: Record<string, unknown>
) {
  const passwordChanged =
    typeof data.password === "string" && data.password.length > 0;
  // Only treat the status as changed when the value actually differs — a
  // plain rename must not revoke the (possibly self-edited) account's
  // active sessions.
  const existing = await findUserByIdRaw(id);
  const statusChanged =
    (data.status !== undefined &&
      !!existing &&
      existing.status !== data.status) ||
    data.archived !== undefined;

  if (passwordChanged) {
    assertPlaintextPassword(data.password);
    const policyError = assertPasswordPolicy(data.password as string);
    if (policyError) {
      const err: any = new Error(policyError);
      err.statusCode = 400;
      throw err;
    }
    const passwordHash = await hashPassword(data.password as string);
    delete data.password;
    data.passwordHash = passwordHash;
  }

  const updated = await staffRepository.updateUser(id, data);

  // A password change or an account status/archive change invalidates every
  // token issued before this instant. Identity checks also reject inactive
  // accounts on the next request; revocation covers any token replay paths.
  if (passwordChanged || statusChanged) {
    revokeUserTokensBeforeNow(id);
  }

  return updated;
}

export async function deleteUser(id: string) {
  const updated = await staffRepository.updateUser(id, { archived: true });
  revokeUserTokensBeforeNow(id);
  return updated;
}

export async function archiveUser(id: string) {
  const updated = await staffRepository.updateUser(id, { archived: true });
  revokeUserTokensBeforeNow(id);
  return updated;
}
