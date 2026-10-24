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

  // Handle errors with explicit HTTP status (e.g. 400, 413, etc.)
  const status = (err as any).status || (err as any).statusCode;
  if (typeof status === "number" && status >= 400 && status < 600) {
    return res.status(status).json({ message: err.message || "An error occurred." });
  }

  res.status(500).json({ message: "Internal server error." });
}
