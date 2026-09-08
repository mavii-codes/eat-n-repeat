import { registerService } from "./register";
import { customerLoginService } from "./login";
import { forgotPasswordService } from "./forgot-password";
import { resetPasswordService } from "./reset-password";
import { verifyEmailService } from "./verify-email";
import { resendVerificationService } from "./resend-verification";
import { changeEmailService } from "./change-email";

export async function register(data: { name: string; email: string; phone?: string; password: string }) {
  return registerService.execute(data);
}

export async function login(data: { email: string; password: string }, ip: string) {
  return customerLoginService.execute(data, ip);
}

export async function forgotPassword(email: string) {
  return forgotPasswordService.execute(email);
}

export async function resetPassword(token: string, password: string) {
  return resetPasswordService.execute(token, password);
}

export async function verifyEmail(token: string) {
  return verifyEmailService.execute(token);
}

export async function resendVerification(email: string) {
  return resendVerificationService.execute(email);
}

export async function changeEmail(data: { email: string; password: string; newEmail: string }) {
  return changeEmailService.execute(data);
}
