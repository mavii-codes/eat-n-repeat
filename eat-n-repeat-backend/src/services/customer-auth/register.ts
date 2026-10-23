import crypto from "crypto";
import { hash } from "@/lib/bcrypt";
import { prisma } from "@/lib/prisma";
import { sendEmailVerificationCode } from "@/lib/email";
import { customerAuthRepository } from "@/repositories/customer-auth.repository";
import { adminFlagsService } from "@/services/admin-flags";
import { logBlockedAttempt } from "@/middleware/security/blocked-attempts";
import { DISPOSABLE_DOMAINS } from "@/middleware/security/disposable-domains";
import { assertPasswordPolicy } from "@/middleware/security/password-policy";
import {
  codeExpiryDate,
  generateVerificationCode,
} from "./verification-code";

const EMAIL_REJECTED_MESSAGE = "This email cannot be used.";
const DUPLICATE_EMAIL_MESSAGE = "An account with this email already exists.";
const USERNAME_TAKEN_MESSAGE = "Username is already taken.";
const USERNAME_INVALID_MESSAGE =
  "Username must be 3-30 characters using letters, numbers, dots, or underscores.";
const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])?$/;
const PLACEHOLDER_DOMAINS = new Set(["example.com", "example.org", "example.net"]);

/**
 * Canonical form used only for duplicate detection. Gmail ignores dots and
 * "+tag" suffixes, and googlemail.com is an alias of gmail.com.
 */
function canonicalEmail(raw: string): string {
  const lower = raw.trim().toLowerCase();
  const at = lower.lastIndexOf("@");
  if (at <= 0 || at === lower.length - 1) return lower;

  let local = lower.slice(0, at);
  let domain = lower.slice(at + 1);

  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") {
    local = local.split("+")[0].replace(/\./g, "");
  }

  return `${local}@${domain}`;
}

export class RegisterService {
  async execute(
    data: { name: string; email: string; password: string; username?: string },
    ip?: string | null,
  ) {
    const { name, password } = data;
    const email = data.email.trim().toLowerCase();
    const domain = email.slice(email.lastIndexOf("@") + 1);

    // ── Email hygiene ──
    if (PLACEHOLDER_DOMAINS.has(domain)) {
      logBlockedAttempt("email-hygiene", ip ?? null, "placeholder_email");
      const err: any = new Error(EMAIL_REJECTED_MESSAGE);
      err.statusCode = 400;
      throw err;
    }

    if (DISPOSABLE_DOMAINS.has(domain)) {
      logBlockedAttempt("email-hygiene", ip ?? null, "disposable_email");
      const err: any = new Error(EMAIL_REJECTED_MESSAGE);
      err.statusCode = 400;
      throw err;
    }

    // ── Duplicate detection ──
    // Exact duplicate first (keeps the historical error copy/status).
    const existing = await customerAuthRepository.findCustomerByEmail(email);
    if (existing) {
      const err: any = new Error(DUPLICATE_EMAIL_MESSAGE);
      err.statusCode = 409;
      throw err;
    }

    // Case/canonical duplicates (e.g. Gmail dot and +tag variants). The
    // customers table is small, so a full email scan is cheap and avoids
    // collation-dependent database comparisons.
    const allCustomers = await customerAuthRepository.findAllCustomerEmails();
    const canonicalTarget = canonicalEmail(email);
    if (allCustomers.some((c) => canonicalEmail(c.email) === canonicalTarget)) {
      logBlockedAttempt("email-hygiene", ip ?? null, "duplicate_email_normalized");
      const err: any = new Error(DUPLICATE_EMAIL_MESSAGE);
      err.statusCode = 409;
      throw err;
    }

    // ── Optional username validation ──
    // Customers authenticate by email and the customers table has no username
    // column, so this only locks a client-supplied handle against the users
    // namespace; it is never persisted.
    const rawUsername = typeof data.username === "string" ? data.username.trim().toLowerCase() : "";
    if (rawUsername) {
      if (
        rawUsername.length < 3 ||
        rawUsername.length > 30 ||
        !USERNAME_REGEX.test(rawUsername)
      ) {
        logBlockedAttempt("email-hygiene", ip ?? null, "username_invalid");
        const err: any = new Error(USERNAME_INVALID_MESSAGE);
        err.statusCode = 400;
        throw err;
      }

      const users = await prisma.user.findMany({ select: { username: true } });
      if (
        users.some((u) => u.username.trim().toLowerCase() === rawUsername)
      ) {
        logBlockedAttempt("email-hygiene", ip ?? null, "username_taken");
        const err: any = new Error(USERNAME_TAKEN_MESSAGE);
        err.statusCode = 409;
        throw err;
      }
    }

    // ── Password policy (before hashing) ──
    const policyError = assertPasswordPolicy(password);
    if (policyError) {
      logBlockedAttempt("password-policy", ip ?? null, "password_policy_violation");
      const err: any = new Error(policyError);
      err.statusCode = 400;
      throw err;
    }

    const passwordHash = await hash(password, 12);
    const id = `cust-${crypto.randomUUID()}`;

    await customerAuthRepository.createCustomer({
      id,
      name,
      email,
      // Phase 3: sign-up never sets a number (nullable column, no migration
      // needed). The number is collected at the first checkout instead.
      phone: null,
      passwordHash,
      status: "pending_verification",
    });

    const code = generateVerificationCode();
    const tokenHash = await hash(code, 10);
    const tokenId = `ev-${crypto.randomUUID()}`;

    await customerAuthRepository.createEmailVerificationToken({
      id: tokenId,
      customerId: id,
      tokenHash,
      expiresAt: codeExpiryDate(),
    });

    try {
      await sendEmailVerificationCode(email, code);
    } catch (error: any) {
      if (error?.message === "Email sending failed" || error?.message === "Missing SMTP configuration") {
        const err: any = new Error("Account created, but we failed to send the verification email. Please try logging in to resend.");
        err.statusCode = 500;
        throw err;
      }
      throw error;
    }

    // Phase 3 signal: repeat signups from one connection in 24h. In-memory
    // (restart resets the window) and self-contained; never fails signup.
    await adminFlagsService.recordSignupAndMaybeFlag({
      ip,
      customerId: id,
      customerName: name,
    });
  }
}

export const registerService = new RegisterService();
