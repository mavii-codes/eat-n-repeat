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
};

import { AdminDataProvider } from "@/context/AdminDataContext";
import { AuthProvider } from "@/context/AuthContext";

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
        <AdminDataProvider>
          <AuthProvider>{children}</AuthProvider>
        </AdminDataProvider>
      </body>
    </html>
  );
}
