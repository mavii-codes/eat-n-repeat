import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { config } from "../config.js";
import { getPool, type DatabaseCustomer } from "../database.js";
import type mysql from "mysql2/promise";

const router = Router();

// Rate limiting state
const loginAttempts = new Map<string, { count: number; timestamp: number }>();

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().email("Please provide a valid email address."),
  phone: z.string().trim().optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number.")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character."),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number.")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character."),
});

const changeEmailSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  newEmail: z.string().trim().email("Please provide a valid new email address."),
});

const resendVerificationSchema = z.object({
  email: z.string().trim().email(),
});

router.post("/register", async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { name, email, phone, password } = parsed.data;
    const pool = getPool();

    // Check duplicate
    const [existing] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM customers WHERE LOWER(email) = ?",
      [email.toLowerCase()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = `cust-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    await pool.execute(
      "INSERT INTO customers (id, name, email, phone, password_hash, status) VALUES (?, ?, ?, ?, ?, ?)",
      [id, name, email.toLowerCase(), phone || null, passwordHash, "active"]
    );

    const verifyToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(verifyToken, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const tokenId = `ev-${Date.now()}`;

    await pool.execute(
      "INSERT INTO email_verification_tokens (id, customer_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
      [tokenId, id, tokenHash, expiresAt]
    );

    await sendVerificationEmail(email, verifyToken);

    return res.status(201).json({ message: "Account created successfully. Please verify your email." });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Valid email and password are required." });
    }

    const { email, password } = parsed.data;
    const ip = req.ip || "unknown";
    const attemptKey = `${ip}:${email.toLowerCase()}`;

    const attempts = loginAttempts.get(attemptKey);
    if (attempts) {
      if (attempts.count >= 5) {
        if (Date.now() - attempts.timestamp < 15 * 60 * 1000) {
          return res.status(429).json({ message: "Too many failed attempts. Try again in 15 minutes." });
        } else {
          loginAttempts.delete(attemptKey);
        }
      }
    }

    const pool = getPool();
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM customers WHERE LOWER(email) = ?",
      [email.toLowerCase()]
    );
    const user = rows[0] as DatabaseCustomer | undefined;

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      const newCount = (attempts?.count || 0) + 1;
      loginAttempts.set(attemptKey, { count: newCount, timestamp: Date.now() });
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (user.status !== "active") {
      return res.status(403).json({ message: "This account is disabled." });
    }

    loginAttempts.delete(attemptKey);

    const token = jwt.sign({}, config.jwtSecret, { subject: user.id, expiresIn: "7d" });
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: "customer"
      }
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

async function sendResetEmail(email: string, token: string) {
  const resetUrl = `${config.clientOrigin}/customer/reset-password?token=${token}`;
  const subject = "Password Reset Request - Eat n RepEat";
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fef3c7; border-radius: 16px; background-color: #FFF8F0;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #451a03; margin: 0; font-size: 28px; font-weight: 900;">Eat n RepEat</h1>
        </div>
        <div style="background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); text-align: center;">
          <h2 style="color: #1c1917; font-size: 22px; margin-top: 0; font-weight: 900;">Reset Your Password</h2>
          <p style="color: #57534e; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            We received a request to reset the password for your Eat n RepEat account. Click the button below to choose a new password.
          </p>
          <a href="${resetUrl}" style="background-color: #B91C1C; color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: 800; font-size: 16px; display: inline-block;">
            Reset Password
          </a>
          <p style="color: #a8a29e; font-size: 13px; margin-top: 30px; margin-bottom: 0;">
            This link will expire in 30 minutes. If you did not request this, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;

  if (config.smtp.host === "smtp.resend.com") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.smtp.pass}`,
      },
      body: JSON.stringify({
        from: config.smtp.from,
        to: email,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(`Resend API Error: ${JSON.stringify(errorData)}`);
    }
    console.log("Password reset email successfully sent to (via Resend REST API):", email);
    return;
  }

  let transporter;
  if (config.smtp.host && config.smtp.user) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  } else {
    // Fallback to ethereal for testing
    let testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  const info = await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject,
    html
  });

  if (!config.smtp.host) {
    console.log("Password reset email sent! Preview URL: %s", nodemailer.getTestMessageUrl(info));
  } else {
    console.log("Password reset email successfully sent to:", email);
  }
}

async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${config.clientOrigin}/customer/verify-email?token=${token}`;
  const subject = "Verify Your Email - Eat n RepEat";
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fef3c7; border-radius: 16px; background-color: #FFF8F0;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #451a03; margin: 0; font-size: 28px; font-weight: 900;">Eat n RepEat</h1>
        </div>
        <div style="background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); text-align: center;">
          <h2 style="color: #1c1917; font-size: 22px; margin-top: 0; font-weight: 900;">Verify Your Email</h2>
          <p style="color: #57534e; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            Welcome to Eat n RepEat! To finish activating your account and start ordering, please verify your email address by clicking the button below.
          </p>
          <a href="${verifyUrl}" style="background-color: #B91C1C; color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: 800; font-size: 16px; display: inline-block;">
            Verify Email Address
          </a>
          <p style="color: #a8a29e; font-size: 13px; margin-top: 30px; margin-bottom: 0;">
            If you did not create this account, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;

  if (config.smtp.host === "smtp.resend.com") {
    // Use Resend REST API to bypass SMTP networking bugs
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.smtp.pass}`,
      },
      body: JSON.stringify({
        from: config.smtp.from,
        to: email,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(`Resend API Error: ${JSON.stringify(errorData)}`);
    }
    console.log("Verification email successfully sent to (via Resend REST API):", email);
    return;
  }

  // Fallback to Nodemailer SMTP
  let transporter;
  if (config.smtp.host && config.smtp.user) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  } else {
    let testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  const info = await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject,
    html
  });

  if (!config.smtp.host) {
    console.log("Verification email sent! Preview URL: %s", nodemailer.getTestMessageUrl(info));
  } else {
    console.log("Verification email successfully sent to:", email);
  }
}

router.post("/forgot-password", async (req, res) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Valid email is required." });
    }

    const { email } = parsed.data;
    const pool = getPool();
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT id, status FROM customers WHERE LOWER(email) = ?",
      [email.toLowerCase()]
    );
    const user = rows[0];

    if (user && user.status === "active") {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(resetToken, 10);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      const tokenId = `rt-${Date.now()}`;

      await pool.execute(
        "INSERT INTO password_reset_tokens (id, customer_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
        [tokenId, user.id, tokenHash, expiresAt]
      );

      await sendResetEmail(email, resetToken);
    }

    return res.json({ message: "If an account exists, a reset link has been sent to your email." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { token, password } = parsed.data;
    const pool = getPool();

    // Clean up expired tokens periodically
    await pool.execute("DELETE FROM password_reset_tokens WHERE expires_at < NOW()");

    const [tokens] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT id, customer_id, token_hash FROM password_reset_tokens"
    );

    let foundToken = null;
    for (const t of tokens) {
      if (await bcrypt.compare(token, t.token_hash)) {
        foundToken = t;
        break;
      }
    }

    if (!foundToken) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.execute(
      "UPDATE customers SET password_hash = ? WHERE id = ?",
      [passwordHash, foundToken.customer_id]
    );

    await pool.execute("DELETE FROM password_reset_tokens WHERE id = ?", [foundToken.id]);

    return res.json({ message: "Password has been successfully reset." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

router.get("/verify-email", async (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) return res.status(400).json({ message: "Invalid or missing token." });

    const pool = getPool();
    await pool.execute("DELETE FROM email_verification_tokens WHERE expires_at < NOW()");

    const [tokens] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT id, customer_id, token_hash FROM email_verification_tokens"
    );

    let foundToken = null;
    for (const t of tokens) {
      if (await bcrypt.compare(token, t.token_hash)) {
        foundToken = t;
        break;
      }
    }

    if (!foundToken) {
      return res.status(400).json({ message: "Invalid or expired verification token." });
    }

    await pool.execute("UPDATE customers SET status = 'active' WHERE id = ?", [foundToken.customer_id]);
    await pool.execute("DELETE FROM email_verification_tokens WHERE id = ?", [foundToken.id]);

    return res.json({ message: "Email successfully verified!" });
  } catch (error) {
    console.error("Verify Email Error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

router.post("/resend-verification", async (req, res) => {
  try {
    const parsed = resendVerificationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Valid email is required." });

    const { email } = parsed.data;
    const pool = getPool();
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT id, status FROM customers WHERE LOWER(email) = ?",
      [email.toLowerCase()]
    );
    const user = rows[0];

    if (user && user.status === "pending_verification") {
      // Invalidate old tokens
      await pool.execute("DELETE FROM email_verification_tokens WHERE customer_id = ?", [user.id]);

      const verifyToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(verifyToken, 10);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const tokenId = `ev-${Date.now()}`;

      await pool.execute(
        "INSERT INTO email_verification_tokens (id, customer_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
        [tokenId, user.id, tokenHash, expiresAt]
      );

      await sendVerificationEmail(email, verifyToken);
    }

    return res.json({ message: "If an unverified account exists, a new link has been sent." });
  } catch (error) {
    console.error("Resend Verification Error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

router.post("/change-email", async (req, res) => {
  try {
    const parsed = changeEmailSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

    const { email, password, newEmail } = parsed.data;
    const pool = getPool();

    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM customers WHERE LOWER(email) = ?",
      [email.toLowerCase()]
    );
    const user = rows[0] as DatabaseCustomer | undefined;

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Check if new email is taken
    const [existing] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM customers WHERE LOWER(email) = ?",
      [newEmail.toLowerCase()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: "The new email address is already in use." });
    }

    // Update email
    await pool.execute(
      "UPDATE customers SET email = ? WHERE id = ?",
      [newEmail.toLowerCase(), user.id]
    );

    // Invalidate old tokens and generate new
    await pool.execute("DELETE FROM email_verification_tokens WHERE customer_id = ?", [user.id]);
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(verifyToken, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const tokenId = `ev-${Date.now()}`;

    await pool.execute(
      "INSERT INTO email_verification_tokens (id, customer_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
      [tokenId, user.id, tokenHash, expiresAt]
    );

    await sendVerificationEmail(newEmail, verifyToken);

    return res.json({ message: "Email address updated and a new verification link sent." });
  } catch (error) {
    console.error("Change Email Error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

export default router;
