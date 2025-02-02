import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "D33pS33k",
  description: "Advanced search with AI-powered analysis",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white">{children}</body>
    </html>
  );
}
