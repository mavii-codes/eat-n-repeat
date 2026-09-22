import { prisma } from "@/lib/prisma";

export class CustomerAuthRepository {
  // Customer helpers
  async findCustomerByEmail(email: string) {
    return prisma.customer.findFirst({
      where: { email: { equals: email } },
    });
  }

  async findAllCustomers() {
    return prisma.customer.findMany();
  }

  async findAllCustomerEmails() {
    return prisma.customer.findMany({ select: { email: true } });
  }

  async createCustomer(data: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    passwordHash: string;
    status: string;
  }) {
    return prisma.customer.create({ data });
  }

  async findCustomerByEmailWithIdStatusEmail(email: string) {
    return prisma.customer.findFirst({
      where: { email: { equals: email } },
      select: { id: true, status: true, email: true },
    });
  }

  async findAllCustomersWithIdStatusEmail() {
    return prisma.customer.findMany({ select: { id: true, status: true, email: true } });
  }

  async findCustomerByEmailWithIdStatus(email: string) {
    return prisma.customer.findFirst({
      where: { email: { equals: email } },
      select: { id: true, status: true },
    });
  }

  async updateCustomerPasswordHash(customerId: string, passwordHash: string) {
    return prisma.customer.update({
      where: { id: customerId },
      data: { passwordHash },
    });
  }

  async updateCustomerStatusById(customerId: string, status: string) {
    return prisma.customer.update({
      where: { id: customerId },
      data: { status },
    });
  }

  async updateCustomerEmailById(customerId: string, email: string) {
    return prisma.customer.update({
      where: { id: customerId },
      data: { email },
    });
  }

  // Email verification token helpers
  async createEmailVerificationToken(data: {
    id: string;
    customerId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return prisma.emailVerificationToken.create({ data });
  }

  async deleteExpiredEmailVerificationTokens() {
    return prisma.emailVerificationToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  async findAllEmailVerificationTokens() {
    return prisma.emailVerificationToken.findMany();
  }

  async deleteEmailVerificationTokenById(id: string) {
    return prisma.emailVerificationToken.delete({ where: { id } });
  }

  async deleteEmailVerificationTokensByCustomerId(customerId: string) {
    return prisma.emailVerificationToken.deleteMany({ where: { customerId } });
  }

  // Password reset token helpers
  async createPasswordResetToken(data: {
    id: string;
    customerId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return prisma.passwordResetToken.create({ data });
  }

  async deleteExpiredPasswordResetTokens() {
    return prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  async findAllPasswordResetTokens() {
    return prisma.passwordResetToken.findMany();
  }

  async deletePasswordResetTokenById(id: string) {
    return prisma.passwordResetToken.delete({ where: { id } });
  }

  async deletePasswordResetTokensByCustomerId(customerId: string) {
    return prisma.passwordResetToken.deleteMany({ where: { customerId } });
  }
}

export const customerAuthRepository = new CustomerAuthRepository();
