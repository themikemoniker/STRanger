import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ranger",
  description: "Self-hosted UI feature review automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
