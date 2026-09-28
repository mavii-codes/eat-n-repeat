import type { Response } from "express";
import { staffSchema } from "@/schema/staff/staff.schema";
import * as service from "@/services/staff";

export class StaffController {
  async getAllUsers(_req: any, res: Response) {
    try {
      const users = await service.getAllUsers();
      const safeUsers = users.map((u: any) => {
        const { passwordHash, ...rest } = u;
        return rest;
      });
      res.json({ users: safeUsers });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }

  async createUser(req: any, res: Response) {
    try {
      // Trim identity fields before validation: login trims the identifier,
      // so a stored "maria " could never log in from another device.
      if (req.body && typeof req.body === "object") {
        for (const key of ["name", "username", "email"] as const) {
          if (typeof req.body[key] === "string") req.body[key] = req.body[key].trim();
        }
      }
      const parsed = staffSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.format() });
      }

      const { password, ...userData } = parsed.data;

      if (!password) {
        return res.status(400).json({ message: "Password is required for new accounts" });
      }

      const existingEmail = await service.findUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(409).json({ message: "Email already in use" });
      }

      const existingUsername = await service.findUserByUsername(userData.username);
      if (existingUsername) {
        return res.status(409).json({ message: "Username already in use" });
      }

      const newUser = await service.createUser({
        name: userData.name,
        username: userData.username,
        email: userData.email,
        password,
        role: userData.role,
        status: userData.status,
        archived: userData.archived ?? false,
      });

      const { passwordHash, ...safeUser } = newUser as any;
      res.status(201).json({ user: safeUser });
    } catch (error: any) {
      console.error(error);
      // Surface client errors (e.g. hash-as-password 400); keep 500s generic.
      const status = error?.statusCode ?? 500;
      const message =
        status >= 500 ? "Server error" : (error?.message ?? "Server error");
      res.status(status).json({ message });
    }
  }

  async updateUser(req: any, res: Response) {
    try {
      if (req.body && typeof req.body === "object") {
        for (const key of ["name", "username", "email"] as const) {
          if (typeof req.body[key] === "string") req.body[key] = req.body[key].trim();
        }
      }
      const parsed = staffSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.format() });
      }

      const { password, ...userData } = parsed.data;

      await service.updateUser(req.params.id, {
        ...userData,
        ...(password ? { password } : {}),
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error(error);
      const status = error?.statusCode ?? 500;
      const message =
        status >= 500 ? "Server error" : (error?.message ?? "Server error");
      res.status(status).json({ message });
    }
  }

  async deleteUser(req: any, res: Response) {
    try {
      await service.archiveUser(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
}

export const staffController = new StaffController();
