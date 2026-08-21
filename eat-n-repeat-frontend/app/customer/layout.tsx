import type { Metadata } from "next";
import { Inter, Pacifico } from "next/font/google";
import { CartProvider } from "@/lib/customer/cart";
import { ReviewsProvider } from "@/context/ReviewsContext";
import { CustomerNotificationProvider } from "@/context/CustomerNotificationContext";
import { CustomerChatBot } from "@/components/customer/CustomerChatBot";
import "@/styles/customer.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const pacifico = Pacifico({ weight: "400", subsets: ["latin"], variable: "--font-pacifico" });

export const metadata: Metadata = {
  title: "Menu",
  description: "Browse coffee, meals, milk tea, snacks, and other menu items from Eat n RepEat Cafe.",
};

export default function CustomerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="customer-portal min-h-screen bg-[#FFF8F0] text-stone-900 flex flex-col font-sans">
      <CartProvider>
          <ReviewsProvider>
            <CustomerNotificationProvider>
              {children}
              <CustomerChatBot />
            </CustomerNotificationProvider>
          </ReviewsProvider>
        </CartProvider>
    </div>
  );
}
