import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { CartProvider } from "@/contexts/CartContext";

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
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className="bg-luxury-white text-luxury-noir font-sans antialiased min-h-screen">
        <CartProvider>
          <Header />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
