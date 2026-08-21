import type { Metadata, Viewport } from "next";
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
  title: {
    template: "%s | Eat n RepEat Cafe",
    default: "Eat n RepEat Cafe | Cordova, Cebu",
  },
  description:
    "Eat n RepEat Cafe — coffee, meals, milk tea, snacks, and more in Cordova, Cebu.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://eatnrepeat.vercel.app"),
  openGraph: {
    title: "Eat n RepEat Cafe | Cordova, Cebu",
    description: "Eat n RepEat Cafe — coffee, meals, milk tea, snacks, and more in Cordova, Cebu.",
    url: "/",
    siteName: "Eat n RepEat Cafe",
    locale: "en_PH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eat n RepEat Cafe | Cordova, Cebu",
    description: "Eat n RepEat Cafe — coffee, meals, milk tea, snacks, and more in Cordova, Cebu.",
  },
  icons: {
    icon: "/logo.png?v=2",
    apple: "/logo.png?v=2",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

import { AdminDataProvider } from "@/context/AdminDataContext";
import { AuthProvider } from "@/context/AuthContext";
import { SessionProvider } from "@/lib/customer/auth-provider";
import { NetworkStatusProvider } from "@/context/NetworkStatusContext";
import { OnlineIndicator } from "@/components/shared/OnlineIndicator";
import { OfflineBanner } from "@/components/shared/OfflineBanner";

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
        <NetworkStatusProvider>
          <OfflineBanner />
          <OnlineIndicator />
          <AdminDataProvider>
            <AuthProvider><SessionProvider>{children}</SessionProvider></AuthProvider>
          </AdminDataProvider>
        </NetworkStatusProvider>
      </body>
    </html>
  );
}
