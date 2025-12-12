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
      <body className="bg-luxury-white text-luxury-noir font-sans antialiased min-h-screen">
        <Header />
        <div className="pt-16">
          {children}
        </div>
      </body>
    </html>
  );
}
