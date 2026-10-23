import jwt from "jsonwebtoken";
import { compare } from "@/lib/bcrypt";
import { env } from "@/config/env";
import { authRepository } from "@/repositories/auth.repository";
import { logBlockedAttempt } from "@/middleware/security/blocked-attempts";
import {
  clearLoginFailures,
  isLoginLocked,
  registerLoginFailure,
} from "@/middleware/security/login-guard";
import type { PublicUser } from "./types";

const LOGIN_KIND = "staff";
const LOCKOUT_MESSAGE =
  "Too many sign-in attempts. Please try again in a few minutes.";

function publicUser(user: {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  status: string;
  mustChangePassword: boolean;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
  };
}

export class LoginService {
  async execute(identifier: string, password: string, ip = "unknown") {
    const lower = identifier.toLowerCase();
    const sourceIp = ip || "unknown";

    // Per-account and per-IP buckets compound (5 failures / 10 min by default).
    if (isLoginLocked(LOGIN_KIND, sourceIp, lower)) {
      logBlockedAttempt("login-lockout", sourceIp, "staff_login_locked");
      const err: any = new Error(LOCKOUT_MESSAGE);
      err.statusCode = 429;
      throw err;
    }

    // Case-insensitive lookup via repository: fetch candidates and filter in JS to guarantee case-insensitivity regardless of collation
    const users = await authRepository.findAllUsers();
    const user = users.find((u) => u.username.toLowerCase() === lower || u.email.toLowerCase() === lower);

    if (!user || !(await compare(password, user.passwordHash))) {
      registerLoginFailure(LOGIN_KIND, sourceIp, lower);
      const err: any = new Error("Invalid username/email or password.");
      err.statusCode = 401;
      throw err;
    }

    if (user.status !== "active") {
      registerLoginFailure(LOGIN_KIND, sourceIp, lower);
      const err: any = new Error("This account is inactive.");
      err.statusCode = 403;
      throw err;
    }

    clearLoginFailures(LOGIN_KIND, sourceIp, lower);

    // Record the successful sign-in (account-security audit / admin list).
    await authRepository.updateLastLoginAt(user.id, new Date());

    // Carries the role claim so client-side admin-only gates (SSE stream,
    // sidebar badge) can self-check without guessing. The server remains the
    // authority: auth middleware resolves roles from the DB per request.
    const token = jwt.sign({ role: user.role }, env.jwtSecret, { subject: user.id, expiresIn: "30d" });
    return {
      token,
      user: publicUser(user),
      mustChangePassword: user.mustChangePassword,
    };
  }
}

export const loginService = new LoginService();
