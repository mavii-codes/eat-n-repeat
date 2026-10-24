import bcrypt from "bcryptjs";
import { type CustomerAccount, type CustomerRecord, type RegisterInput } from "./types";

const customers = new Map<string, CustomerRecord>();
let seeded = false;

async function seedDemoCustomer() {
  if (seeded) return;
  const hash = await bcrypt.hash("Customer123!", 12);
  const demo: CustomerRecord = {
    id: "cust-demo-1",
    name: "Maria Santos",
    email: "customer@eatnrepeat.ph",
    phone: "09171234567",
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  };
  customers.set(demo.email.toLowerCase(), demo);
  seeded = true;
}

function toPublicAccount(record: CustomerRecord): CustomerAccount {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    createdAt: record.createdAt,
  };
}

export async function findCustomerByEmail(email: string) {
  await seedDemoCustomer();
  return customers.get(email.toLowerCase().trim());
}

export async function verifyCustomerPassword(email: string, password: string) {
  const customer = await findCustomerByEmail(email);
  if (!customer) return null;
  const valid = await bcrypt.compare(password, customer.passwordHash);
  return valid ? toPublicAccount(customer) : null;
}

export async function registerCustomer(input: RegisterInput) {
  await seedDemoCustomer();

  const email = input.email.toLowerCase().trim();
  if (customers.has(email)) {
    throw new Error("An account with this email already exists.");
  }

  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please enter a valid email address.");
  }

  const record: CustomerRecord = {
    id: `cust-${Date.now()}`,
    name: input.name.trim(),
    email,
    phone: input.phone?.trim(),
    passwordHash: await bcrypt.hash(input.password, 12),
    createdAt: new Date().toISOString(),
  };

  customers.set(email, record);
  return toPublicAccount(record);
}
