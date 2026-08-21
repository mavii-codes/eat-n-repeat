import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Learn more about Eat n RepEat Cafe in Cordova, Cebu.",
};

export default function AboutLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
