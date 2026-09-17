import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { type AuthOptions } from "next-auth";

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

        try {
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
          const res = await fetch(`${baseUrl}/api/customer-auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: credentials.email, password: credentials.password }),
          });

          const data = await res.json();

          if (!res.ok) {
            if (data.message === "unverified_email") {
              throw new Error("unverified_email");
            }
            throw new Error(data.message || "Invalid email or password.");
          }

          if (!data.token || !data.user) return null;

          return {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: "customer",
            accessToken: data.token,
          };
        } catch (error) {
          if (error instanceof TypeError) {
            throw new Error("Unable to reach the server. Please try again.");
          }
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.accessToken = (user as any).accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        (session as any).accessToken = token.accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: "/customer/login",
  },
};

export default NextAuth(authOptions);
