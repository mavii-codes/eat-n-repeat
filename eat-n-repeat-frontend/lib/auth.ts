import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { type AuthOptions } from "next-auth";

// Server-side base URL for the Express backend (never exposed to the browser
// beyond this server-executed authorize callback).
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";

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

        // Single source of truth: the Express backend (MySQL-backed customers,
        // verification enforcement, rate limiting). Never the local store.
        let res: Response;
        try {
          res = await fetch(`${BACKEND_URL}/api/customer-auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
        } catch {
          throw new Error("Unable to reach the server. Please try again.");
        }

        if (res.status === 403) {
          const data = await res.json().catch(() => null);
          if (data?.message === "unverified_email") {
            throw new Error("unverified_email");
          }
          return null;
        }
        if (!res.ok) return null;

        const data = await res.json().catch(() => null);
        const user = data?.user;
        if (!user?.id) return null;

        return {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
          role: "customer",
          accessToken: typeof data?.token === "string" ? data.token : undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        const accessToken = (user as any)?.accessToken;
        if (typeof accessToken === "string") token.accessToken = accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      if (typeof (token as any)?.accessToken === "string") {
        (session as any).accessToken = (token as any).accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: "/customer/login",
  },
};

export default NextAuth(authOptions);
