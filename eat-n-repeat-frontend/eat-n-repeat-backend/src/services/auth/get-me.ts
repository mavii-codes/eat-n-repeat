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

export class GetMeService {
  async execute(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user || user.status !== "active") {
      const err: any = new Error("Session is no longer valid.");
      err.statusCode = 401;
      throw err;
    }
    return publicUser(user);
  }
}

export const getMeService = new GetMeService();
