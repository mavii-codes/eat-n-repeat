import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hash(value: string, saltRounds = 12): Promise<string> {
  return bcrypt.hash(value, saltRounds);
}

export async function compare(value: string, hashValue: string): Promise<boolean> {
  return bcrypt.compare(value, hashValue);
}
