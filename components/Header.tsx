"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-4">
            <Image
              src="/images/logo-guess.png"
              alt="GUESS"
              width={100}
              height={36}
              className="h-8 w-auto object-contain"
            />
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-8">
            <Link
              href="/products"
              className={`text-sm font-light tracking-wide transition-colors ${
                pathname === "/products"
                  ? "text-gray-900"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              קטלוג
            </Link>
            
            {isAdmin ? (
              <>
                <Link
                  href="/admin/products"
                  className={`text-sm font-light tracking-wide transition-colors ${
                    pathname === "/admin/products"
                      ? "text-gray-900"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  ניהול מוצרים
                </Link>
                <Link
                  href="/admin/upload"
                  className={`text-sm font-light tracking-wide transition-colors ${
                    pathname === "/admin/upload"
                      ? "text-gray-900"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  העלאת קובץ
                </Link>
              </>
            ) : (
              <Link
                href="/admin/products"
                className="text-sm font-light tracking-wide text-gray-500 hover:text-gray-900 transition-colors"
              >
                ניהול
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
