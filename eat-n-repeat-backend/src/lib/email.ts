import { env } from "@/config/env";
import nodemailer from "nodemailer";

export type EmailSendResult = {
  ok: boolean;
  provider?: "resend" | "gmail" | "smtp";
  id?: string;
};

function emailFailure(message = "Email sending failed"): Error {
  return new Error(message);
}

async function sendEmail(to: string, subject: string, html: string): Promise<EmailSendResult> {
  // Priority 1: Resend API
  if (env.resend.apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.resend.apiKey}`,
        },
        body: JSON.stringify({ from: env.resend.from, to, subject, html }),
      });
      if (res.ok) {
        let id: string | undefined;
        try {
          const data = await res.json();
          if (data && typeof data.id === "string") id = data.id;
        } catch {
          // ID is best-effort; delivery already accepted.
        }
        console.log(`[Email] Sent via Resend to ${to}${id ? ` (id: ${id})` : ""}`);
        return { ok: true, provider: "resend", id };
      }
      console.error("[Email] Resend failed:", await res.text());
    } catch (e) {
      console.error("[Email] Resend error:", e);
    }
  }

  // Priority 2: Gmail API via HTTPS
  if (env.gmailApi.clientId && env.gmailApi.refreshToken) {
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.gmailApi.clientId,
          client_secret: env.gmailApi.clientSecret,
          refresh_token: env.gmailApi.refreshToken,
          grant_type: "refresh_token",
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) throw new Error("No access token");

      const fromEmail = env.gmailApi.user || env.smtp.user;
      const message = [
        `From: "Eat n RepEat Cafe" <${fromEmail}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `Content-Type: text/html; charset="UTF-8"`,
        "",
        html,
      ].join("\r\n");

      const encodedMessage = Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const sendRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: encodedMessage }),
        }
      );

      if (sendRes.ok) {
        console.log(`[Email] Sent via Gmail API to ${to}`);
        return { ok: true, provider: "gmail" };
      }
      console.error("[Email] Gmail API failed:", await sendRes.text());
    } catch (e) {
      console.error("[Email] Gmail API error:", e);
    }
  }

  // Priority 3: SMTP via Nodemailer
  if (env.smtp.host && env.smtp.user) {
    try {
      const transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: { user: env.smtp.user, pass: env.smtp.pass },
      });
      const info = await transporter.sendMail({ from: env.smtp.from, to, subject, html });
      console.log(`[Email] Sent via SMTP to ${to}${info?.messageId ? ` (id: ${info.messageId})` : ""}`);
      return { ok: true, provider: "smtp", id: info?.messageId };
    } catch (e) {
      console.error("[Email] SMTP error:", e);
    }
  }

  console.warn(`[Email] All providers failed or unconfigured; email to ${to} NOT sent.`);
  throw emailFailure();
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${env.clientOrigin}/customer/verify-email?token=${token}`;
  const subject = "Verify Your Email - Eat n RepEat";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #fef3c7;border-radius:16px;background-color:#FFF8F0;">
      <div style="text-align:center;margin-bottom:20px;">
        <h1 style="color:#451a03;margin:0;font-size:28px;font-weight:900;">Eat n RepEat</h1>
      </div>
      <div style="background-color:white;padding:30px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.02);text-align:center;">
        <h2 style="color:#1c1917;font-size:22px;margin-top:0;font-weight:900;">Verify Your Email</h2>
        <p style="color:#57534e;font-size:16px;line-height:1.6;margin-bottom:30px;">Welcome to Eat n RepEat! Please verify your email address.</p>
        <a href="${verifyUrl}" style="background-color:#B91C1C;color:white;padding:14px 32px;text-decoration:none;border-radius:50px;font-weight:800;font-size:16px;display:inline-block;">Verify Email Address</a>
        <p style="color:#a8a29e;font-size:13px;margin-top:30px;margin-bottom:0;">If you did not create this account, you can safely ignore this email.</p>
      </div>
    </div>`;
  await sendEmail(email, subject, html);
}

export async function sendResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${env.clientOrigin}/customer/reset-password?token=${token}`;
  const subject = "Password Reset Request - Eat n RepEat";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #fef3c7;border-radius:16px;background-color:#FFF8F0;">
      <div style="text-align:center;margin-bottom:20px;">
        <h1 style="color:#451a03;margin:0;font-size:28px;font-weight:900;">Eat n RepEat</h1>
      </div>
      <div style="background-color:white;padding:30px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.02);text-align:center;">
        <h2 style="color:#1c1917;font-size:22px;margin-top:0;font-weight:900;">Reset Your Password</h2>
        <p style="color:#57534e;font-size:16px;line-height:1.6;margin-bottom:30px;">We received a request to reset your password.</p>
        <a href="${resetUrl}" style="background-color:#B91C1C;color:white;padding:14px 32px;text-decoration:none;border-radius:50px;font-weight:800;font-size:16px;display:inline-block;">Reset Password</a>
        <p style="color:#a8a29e;font-size:13px;margin-top:30px;margin-bottom:0;">This link expires in 30 minutes.</p>
      </div>
    </div>`;
  await sendEmail(email, subject, html);
}
