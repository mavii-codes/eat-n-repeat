import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { CartProvider } from "@/lib/customer/cart";
import { SessionProvider } from "@/lib/customer/auth-provider";
import "@/styles/customer.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Eat n RepEat – Customer Portal",
  description: "Cozy café ordering experience for customers."
};

export default function CustomerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground customer-portal">
        <SessionProvider>
          <CartProvider>{children}</CartProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
