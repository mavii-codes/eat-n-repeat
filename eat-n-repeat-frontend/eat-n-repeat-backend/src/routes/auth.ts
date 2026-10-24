import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { findUserById, findUserByIdentifier, type DatabaseUser } from "../database.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/require-auth.js";

const router = Router();
const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

const publicUser = (user: DatabaseUser) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,
  status: user.status,
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Identifier and password are required." });

  const identifier = parsed.data.identifier.toLowerCase();
  const user = await findUserByIdentifier(identifier);

  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    return res.status(401).json({ message: "Invalid username/email or password." });
  }
  if (user.status !== "active") return res.status(403).json({ message: "This account is inactive." });

  const token = jwt.sign({}, config.jwtSecret, { subject: user.id, expiresIn: "8h" });
  return res.json({ token, user: publicUser(user) });
});

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await findUserById(req.auth!.userId);
  if (!user || user.status !== "active") return res.status(401).json({ message: "Session is no longer valid." });
  return res.json({ user: publicUser(user) });
});

export default router;
