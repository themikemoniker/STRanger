import type { Metadata } from "next";
import Link from "next/link";
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
      <body className="bg-gray-50 text-gray-900">
        <div className="flex min-h-screen">
          <nav className="w-56 shrink-0 border-r border-gray-200 bg-white p-4">
            <Link href="/reviews" className="block text-lg font-bold mb-6">
              Ranger
            </Link>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/reviews"
                  className="block rounded px-3 py-2 text-sm hover:bg-gray-100"
                >
                  Reviews
                </Link>
              </li>
            </ul>
          </nav>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
