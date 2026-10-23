import type { Metadata } from "next";
import { DM_Sans, Geist_Mono, Pacifico, Playfair_Display } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const pacifico = Pacifico({
  variable: "--font-pacifico",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Eat n' Repeat | Admin Portal",
  description:
    "Owner admin portal for Eat n' Repeat Cordova — sales, inventory, and system management.",
  icons: {
    icon: "/logo.png?v=2",
    apple: "/logo.png?v=2",
  },
  // Invisible deploy tracer: proves exactly which commit serves production.
  // Vercel injects VERCEL_GIT_COMMIT_SHA at build time; local builds say "local".
  other: {
    "app-build": process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  },
};

import { AdminDataProvider } from "@/context/AdminDataContext";
import { AuthProvider } from "@/context/AuthContext";
import { NetworkStatusProvider } from "@/context/NetworkStatusContext";
import { OnlineIndicator } from "@/components/shared/OnlineIndicator";
import { Toaster } from "react-hot-toast";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${geistMono.variable} ${playfair.variable} ${pacifico.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <OnlineIndicator />
        <AdminDataProvider>
          <AuthProvider>
            <NetworkStatusProvider>{children}</NetworkStatusProvider>
          </AuthProvider>
        </AdminDataProvider>
        {/* Global toast layer — one mount for the whole app (admin + staff +
            customer portals). Toasts fire from cash/staff/inventory/POS and
            NetworkStatus code; this finally gives them a visible surface:
            warm cream card, stone text, subtle shadow. */}
        <Toaster
          position="top-center"
          containerStyle={{ zIndex: 9999 }}
          toastOptions={{
            style: {
              background: "#FFFBF2",
              color: "#292524",
              border: "1px solid #E7E5E4",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.10)",
              fontSize: "13.5px",
              fontWeight: 600,
              maxWidth: "420px",
            },
            success: { iconTheme: { primary: "#16A34A", secondary: "#FFFBF2" } },
            error: { iconTheme: { primary: "#DC2626", secondary: "#FFFBF2" } },
            loading: { iconTheme: { primary: "#800000", secondary: "#FFFBF2" } },
          }}
        />
      </body>
    </html>
  );
}
