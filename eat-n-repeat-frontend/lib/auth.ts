import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { type AuthOptions } from "next-auth";
import { verifyCustomerPassword } from "@/lib/customer/customer-store";

export const authOptions: AuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? "eat-n-repeat-dev-secret-change-in-production",
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await verifyCustomerPassword(
          credentials.email,
          credentials.password,
        );

        if (!user) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: "customer",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/customer/login",
  },
};

export default NextAuth(authOptions);
