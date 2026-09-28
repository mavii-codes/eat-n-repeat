import { staffRepository } from "@/repositories/staff.repository";
import { hashPassword } from "@/lib/bcrypt";

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

  return staffRepository.createUser({
    id: uuidv4(),
    name: data.name,
    username: data.username,
    email: data.email,
    passwordHash,
    role: data.role,
    status: data.status,
    archived: data.archived ?? false,
  });
}

export async function updateUser(
  id: string,
  data: Record<string, unknown>
) {
  if (data.password) {
    assertPlaintextPassword(data.password);
    const passwordHash = await hashPassword(data.password as string);
    delete data.password;
    data.passwordHash = passwordHash;
  }

  return staffRepository.updateUser(id, data);
}

export async function deleteUser(id: string) {
  return staffRepository.updateUser(id, { archived: true });
}

export async function archiveUser(id: string) {
  return staffRepository.updateUser(id, { archived: true });
}
