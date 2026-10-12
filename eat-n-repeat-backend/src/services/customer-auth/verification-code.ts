import crypto from "crypto";

/**
 * Shared one-time verification-code rules for the customer auth flow.
 *
 * Codes are 6 digits from a CSPRNG, hashed with bcrypt before storage
 * (same convention as the legacy link tokens), valid for 10 minutes,
 * single-use, and purpose-separated by table: email-verification codes
 * live in EmailVerificationToken rows, password-reset codes in
 * PasswordResetToken rows, so one can never validate as the other.
 * Max 5 wrong attempts per issued code; 60s resend cooldown derived
 * from the latest row's createdAt (survives restarts, no extra column).
 */
export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
export const VERIFICATION_CODE_MAX_ATTEMPTS = 5;
export const VERIFICATION_CODE_RESEND_COOLDOWN_MS = 60 * 1000;

export function generateVerificationCode(): string {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

export function codeExpiryDate(): Date {
  return new Date(Date.now() + VERIFICATION_CODE_TTL_MS);
}

/** Throws a 429 error when a code was issued less than 60s ago. */
export function assertResendCooldownOk(latestCreatedAt?: Date | null) {
  if (!latestCreatedAt) return;
  const elapsed = Date.now() - new Date(latestCreatedAt).getTime();
  if (elapsed < VERIFICATION_CODE_RESEND_COOLDOWN_MS) {
    const err: any = new Error("Please wait 60 seconds before requesting another code.");
    err.statusCode = 429;
    throw err;
  }
}

function tooManyAttemptsError(): Error {
  const err: any = new Error("Too many attempts. Please request a new code.");
  err.statusCode = 429;
  return err;
}

function invalidCodeError(): Error {
  const err: any = new Error("Invalid verification code. Please try again.");
  err.statusCode = 400;
  return err;
}

function expiredCodeError(): Error {
  const err: any = new Error("This code has expired. Please request a new code.");
  err.statusCode = 400;
  return err;
}

export const verificationCodeErrors = {
  tooManyAttemptsError,
  invalidCodeError,
  expiredCodeError,
};

// ---------------------------------------------------------------------------
// Short-lived password-reset authorizations, issued only after a reset code
// is verified. In-memory (single backend instance, 10-minute life,
// single-use by construction): nothing to migrate, nothing lingering in
// the database, and a stolen/expired value is useless on its own.
// Keyed by SHA-256 of the token so the raw value never sits in memory.
// ---------------------------------------------------------------------------
type ResetAuthorization = { customerId: string; expiresAt: number };
const resetAuthorizations = new Map<string, ResetAuthorization>();

function keyOf(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function issueResetAuthorization(customerId: string): string {
  const token = `pra-${crypto.randomBytes(32).toString("hex")}`;
  resetAuthorizations.set(keyOf(token), {
    customerId,
    expiresAt: Date.now() + VERIFICATION_CODE_TTL_MS,
  });
  return token;
}

/** Single-use: returns the customer id once, then the token is dead. */
export function consumeResetAuthorization(token: string): string | null {
  if (!token) return null;
  const key = keyOf(token);
  const record = resetAuthorizations.get(key);
  if (!record) return null;
  resetAuthorizations.delete(key);
  if (Date.now() > record.expiresAt) return null;
  return record.customerId;
}
