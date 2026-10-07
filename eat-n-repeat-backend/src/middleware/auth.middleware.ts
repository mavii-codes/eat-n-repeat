import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "@/config/env";

export type AuthenticatedRequest = Request & { auth?: { userId: string; role?: string } };

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Check Authorization header first, then query parameter (for SSE connections)
  const headerToken = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const queryToken = req.query.token as string | undefined;
  const token = headerToken || queryToken;
  
  if (!token) return res.status(401).json({ message: "Authentication required." });

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (!payload || typeof payload === "string" || !payload.sub) {
      return res.status(401).json({ message: "Invalid token." });
    }
    req.auth = { 
      userId: payload.sub as string,
      role: (payload as any).role as string | undefined
    };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const headerToken = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const queryToken = req.query.token as string | undefined;
  const token = headerToken || queryToken;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload && typeof payload !== "string" && payload.sub) {
      req.auth = { 
        userId: payload.sub as string,
        role: (payload as any).role as string | undefined
      };
    }
  } catch {}

  next();
}
