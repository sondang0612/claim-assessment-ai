import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Insurance Plans — Papaya",
  description: "Compare Bronze, Silver, and Gold insurance plans side by side",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.className}`}>
      <body className="min-h-full bg-white text-gray-900">{children}</body>
    </html>
  );
}
