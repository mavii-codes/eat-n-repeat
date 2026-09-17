import type { Metadata } from "next";
import { Inter, Pacifico } from "next/font/google";
import { CartProvider } from "@/lib/customer/cart";
import { SessionProvider } from "@/lib/customer/auth-provider";
import { OnlineIndicator } from "@/components/shared/OnlineIndicator";
import "@/styles/customer.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const pacifico = Pacifico({ weight: "400", subsets: ["latin"], variable: "--font-pacifico" });

export const metadata: Metadata = {
  title: "Eat n RepEat – Customer Portal",
  description: "Cozy café ordering experience for customers."
};

export default function CustomerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="customer-portal min-h-screen bg-[#FFF8F0] text-stone-900 flex flex-col font-sans">
      <SessionProvider>
        <CartProvider>{children}</CartProvider>
      </SessionProvider>
    </div>
  );
}
