import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("[Error]", err);

  // Prisma known request errors
  if ((err as any).code) {
    const code = (err as any).code;
    if (code === "P2002") {
      return res.status(409).json({ message: "A record with that value already exists." });
    }
    if (code === "P2025") {
      return res.status(404).json({ message: "Record not found." });
    }
  }

  res.status(500).json({ message: "Internal server error." });
}
