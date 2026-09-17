import jwt from "jsonwebtoken";
import { compare } from "@/lib/bcrypt";
import { env } from "@/config/env";
import { customerAuthRepository } from "@/repositories/customer-auth.repository";

// Rate limiting state (same as old route)
const loginAttempts = new Map<string, { count: number; timestamp: number }>();

export class CustomerLoginService {
  async execute(data: { email: string; password: string }, ip: string) {
    const { email, password } = data;
    const lowerEmail = email.toLowerCase();
    const attemptKey = `${ip}:${lowerEmail}`;

    const attempts = loginAttempts.get(attemptKey);
    if (attempts) {
      if (attempts.count >= 5) {
        if (Date.now() - attempts.timestamp < 15 * 60 * 1000) {
          const err: any = new Error("Too many failed attempts. Try again in 15 minutes.");
          err.statusCode = 429;
          throw err;
        } else {
          loginAttempts.delete(attemptKey);
        }
      }
    }

    // Find customer case-insensitive
    let customer = await customerAuthRepository.findCustomerByEmail(lowerEmail);
    // Fallback JS filter if not found due to collation
    if (!customer) {
      const all = await customerAuthRepository.findAllCustomers();
      customer = all.find((c) => c.email.toLowerCase() === lowerEmail) ?? null;
    }

    if (!customer || !(await compare(password, customer.passwordHash))) {
      const newCount = (attempts?.count || 0) + 1;
      loginAttempts.set(attemptKey, { count: newCount, timestamp: Date.now() });
      const err: any = new Error("Invalid email or password.");
      err.statusCode = 401;
      throw err;
    }

    if (customer.status === "pending_verification") {
      const err: any = new Error("unverified_email");
      err.statusCode = 403;
      throw err;
    }

    if (customer.status !== "active") {
      const err: any = new Error("This account is disabled.");
      err.statusCode = 403;
      throw err;
    }

    loginAttempts.delete(attemptKey);

    const token = jwt.sign({}, env.jwtSecret, { subject: customer.id, expiresIn: "7d" });
    return {
      token,
      user: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        role: "customer" as const,
      },
    };
  }
}

export const customerLoginService = new CustomerLoginService();
