import jwt from "jsonwebtoken";
import { compare } from "@/lib/bcrypt";
import { env } from "@/config/env";
import { customerAuthRepository } from "@/repositories/customer-auth.repository";
import { adminFlagsService } from "@/services/admin-flags";
import { logBlockedAttempt } from "@/middleware/security/blocked-attempts";
import {
  clearLoginFailures,
  isLoginLocked,
  registerLoginFailure,
} from "@/middleware/security/login-guard";

const LOGIN_KIND = "customer";
const LOCKOUT_MESSAGE =
  "Too many sign-in attempts. Please try again in a few minutes.";

export class CustomerLoginService {
  async execute(data: { email: string; password: string }, ip: string) {
    const { email, password } = data;
    const lowerEmail = email.toLowerCase();
    const sourceIp = ip || "unknown";

    // Per-account and per-IP buckets compound (5 failures / 10 min by default).
    if (isLoginLocked(LOGIN_KIND, sourceIp, lowerEmail)) {
      logBlockedAttempt("login-lockout", sourceIp, "customer_login_locked");
      const err: any = new Error(LOCKOUT_MESSAGE);
      err.statusCode = 429;
      throw err;
    }

    // Find customer case-insensitive
    let customer = await customerAuthRepository.findCustomerByEmail(lowerEmail);
    // Fallback JS filter if not found due to collation
    if (!customer) {
      const all = await customerAuthRepository.findAllCustomers();
      customer = all.find((c) => c.email.toLowerCase() === lowerEmail) ?? null;
    }

    if (!customer || !(await compare(password, customer.passwordHash))) {
      registerLoginFailure(LOGIN_KIND, sourceIp, lowerEmail);
      // Phase 3 signal: 5 failures per email in a rolling hour (in-memory,
      // self-contained; a flag is only possible when the account exists).
      await adminFlagsService.recordFailedLoginAttempt({
        email: lowerEmail,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? null,
      });
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

    clearLoginFailures(LOGIN_KIND, sourceIp, lowerEmail);
    adminFlagsService.clearFailedLoginAttempts(lowerEmail);

    // Record the successful sign-in (account-security audit / admin list).
    await customerAuthRepository.updateLastLoginAt(customer.id, new Date());

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
