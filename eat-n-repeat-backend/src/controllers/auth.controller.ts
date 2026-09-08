import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { loginSchema } from "@/schema/auth/auth.schema";
import { loginService, getMeService } from "@/services/auth";

export class AuthController {
  async login(req: Request, res: Response) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Identifier and password are required." });
    }

    try {
      const result = await loginService.execute(parsed.data.identifier, parsed.data.password);
      return res.json(result);
    } catch (err: any) {
      const status = err.statusCode ?? 500;
      const message = err.message ?? "Internal server error.";
      return res.status(status).json({ message });
    }
  }

  async getMe(req: AuthenticatedRequest, res: Response) {
    try {
      const user = await getMeService.execute(req.auth!.userId);
      return res.json({ user });
    } catch (err: any) {
      const status = err.statusCode ?? 401;
      const message = err.message ?? "Session is no longer valid.";
      return res.status(status).json({ message });
    }
  }
}

export const authController = new AuthController();
