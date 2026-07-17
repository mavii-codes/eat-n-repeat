import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { type NextAuthConfig } from "next-auth";
import { type CustomerAccount } from "@/lib/customer/types";
import { mockCustomers } from "@/lib/customer/mock-data";

export const authOptions: NextAuthConfig = {
  // Use JWT session strategy for simplicity
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "email@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) return null;
        const { email, password } = credentials;
        // Simple lookup in mock data
        const user = mockCustomers.find(
          (c) => c.email === email && c.password === password,
        );
        if (user) {
          // Return object that will be stored in JWT token
          return { id: user.id, name: user.name, email: user.email, role: "customer" } as any;
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Merge user into token on sign‑in
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      // Make token fields available in session
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/customer/login",
  },
};

export default NextAuth(authOptions);
