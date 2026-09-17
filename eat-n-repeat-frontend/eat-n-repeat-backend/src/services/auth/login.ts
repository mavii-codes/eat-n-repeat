import jwt from "jsonwebtoken";
import { compare } from "@/lib/bcrypt";
import { env } from "@/config/env";
import { authRepository } from "@/repositories/auth.repository";
import type { PublicUser } from "./types";

function publicUser(user: { id: string; name: string; username: string; email: string; role: string; status: string }): PublicUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export class LoginService {
  async execute(identifier: string, password: string) {
    const lower = identifier.toLowerCase();

    // Case-insensitive lookup via repository: fetch candidates and filter in JS to guarantee case-insensitivity regardless of collation
    const users = await authRepository.findAllUsers();
    const user = users.find((u) => u.username.toLowerCase() === lower || u.email.toLowerCase() === lower);

    if (!user || !(await compare(password, user.passwordHash))) {
      const err: any = new Error("Invalid username/email or password.");
      err.statusCode = 401;
      throw err;
    }

    if (user.status !== "active") {
      const err: any = new Error("This account is inactive.");
      err.statusCode = 403;
      throw err;
    }

    const token = jwt.sign({}, env.jwtSecret, { subject: user.id, expiresIn: "8h" });
    return { token, user: publicUser(user) };
  }
}

export const loginService = new LoginService();
