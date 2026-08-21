import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { type AuthOptions } from "next-auth";
import { getApiUrl } from "@/lib/config";


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
          const res = await fetch(`${getApiUrl()}/api/customer-auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: credentials.email, password: credentials.password }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || "Invalid credentials");
          }

          const data = await res.json();
          if (!data.user) return null;

          return {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            accessToken: data.token,
          };
        } catch (error: any) {
          console.error("Auth error:", error);
          throw new Error(error.message || "Invalid credentials");
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
        (session as any).accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/customer/login",
  },
};

export default NextAuth(authOptions);
