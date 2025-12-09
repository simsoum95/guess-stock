import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "קטלוג רשמי – GUESS ישראל",
  description: "כל דגמי התיקים והנעליים עם זמינות מלאי בזמן אמת (מוק)."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-brand-black text-white font-sans antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}

