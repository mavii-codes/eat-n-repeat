/**
 * Cloudflare Turnstile server-side verification.
 *
 * Fails closed: any non-success response, missing token, or network error is
 * reported as a generic verification failure. When no secret is configured,
 * non-production environments allow registration (logging the bypass once per
 * process) while production refuses registration with 503.
 */

import { env } from "@/config/env";
import { logBlockedAttempt } from "./blocked-attempts";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const GENERIC_MESSAGE = "Verification failed. Please try again.";

let bypassLogged = false;

export type TurnstileResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

function failure(status: number, message: string): TurnstileResult {
  return { ok: false, status, message };
}

export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null,
): Promise<TurnstileResult> {
  const secret = env.turnstile.secretKey;

  if (!secret) {
    if (env.nodeEnv !== "production") {
      if (!bypassLogged) {
        bypassLogged = true;
        logBlockedAttempt(
          "captcha-bypass",
          ip ?? null,
          "TURNSTILE_SECRET_KEY unset (non-prod bypass)",
        );
      }
      return { ok: true };
    }
    return failure(503, "Registration is temporarily unavailable.");
  }

  const responseToken = typeof token === "string" ? token.trim() : "";
  if (!responseToken) {
    return failure(400, GENERIC_MESSAGE);
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", responseToken);
  if (ip) form.set("remoteip", ip);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    if (!response.ok) {
      return failure(400, GENERIC_MESSAGE);
    }

    const result = (await response.json()) as { success?: boolean };
    if (result?.success !== true) {
      return failure(400, GENERIC_MESSAGE);
    }

    return { ok: true };
  } catch {
    // Network/parse failure: fail closed with the same generic message.
    return failure(400, GENERIC_MESSAGE);
  }
}
