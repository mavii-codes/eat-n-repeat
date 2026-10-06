import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Menu",
  description: "Browse coffee, meals, milk tea, snacks, and other menu items from Eat n RepEat Cafe.",
};

export default function MenuLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
