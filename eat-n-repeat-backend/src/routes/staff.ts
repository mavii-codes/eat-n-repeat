import bcrypt from "bcryptjs";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { createUser, updateUser, archiveUser, getAllUsers, findUserByIdentifier, findUserById } from "../database.js";
import { requireAuth } from "../middleware/require-auth.js";

const router = Router();

// Only authenticated users can access these routes
router.use(requireAuth);

const staffSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email(),
  password: z.string().optional(),
  role: z.enum(["admin", "head_staff", "staff", "delivery_rider"]),
  status: z.enum(["active", "inactive"]),
  archived: z.boolean().optional().default(false),
});

// GET all staff
router.get("/", async (req, res) => {
  try {
    const users = await getAllUsers();
    // omit password hashes
    const safeUsers = users.map(u => {
      const { password_hash, ...rest } = u;
      return rest;
    });
    res.json({ users: safeUsers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// POST new staff
router.post("/", async (req, res) => {
  try {
    const parsed = staffSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data", errors: parsed.error.format() });
    }
    
    const { password, ...userData } = parsed.data;
    
    if (!password) {
      return res.status(400).json({ message: "Password is required for new accounts" });
    }

    const existingUser = await findUserByIdentifier(userData.email);
    if (existingUser) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const existingUsername = await findUserByIdentifier(userData.username);
    if (existingUsername) {
      return res.status(409).json({ message: "Username already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    
    const newUser = {
      id: "sf-" + uuidv4().slice(0, 8),
      ...userData,
      password_hash: passwordHash,
      archived: userData.archived ?? false,
    };

    await createUser(newUser as any);
    
    const { password_hash, ...safeUser } = newUser;
    res.status(201).json({ user: safeUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT update staff
router.put("/:id", async (req, res) => {
  try {
    const parsed = staffSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data", errors: parsed.error.format() });
    }

    const { password, ...userData } = parsed.data;
    const updateData: any = { ...userData };

    if (password && password.trim() !== "") {
      updateData.password_hash = await bcrypt.hash(password, 12);
    }

    await updateUser(req.params.id, updateData);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE (archive) staff
router.delete("/:id", async (req, res) => {
  try {
    await archiveUser(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
