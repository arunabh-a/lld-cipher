import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLD Practice Platform",
  description: "Practice Low-Level Design problems with structured feedback",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <a href="/" className="text-xl font-bold text-indigo-600 hover:text-indigo-700">
              LLD Practice Platform
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
