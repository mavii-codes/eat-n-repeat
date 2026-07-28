import { withAuth } from "next-auth/middleware";

export default withAuth({
  secret: process.env.NEXTAUTH_SECRET ?? "eat-n-repeat-dev-secret-change-in-production",
  callbacks: {
    authorized: () => true, // allow public browsing, protected actions handled inside components
  },
});

export const config = {
  matcher: [
    "/customer/orders/:path*",
    "/customer/favorites/:path*",
    "/customer/profile/:path*",
  ],
};
