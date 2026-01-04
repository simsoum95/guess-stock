"use client";

import Image from "next/image";
import Link from "next/link";
import { CartIcon } from "./CartIcon";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-luxury-white/98 backdrop-blur-sm border-b border-luxury-grey/10">
      <div className="mx-auto max-w-[1800px] flex items-center justify-between px-12 py-8">
        {/* Navigation Left */}
        <nav className="flex items-center gap-10">
          <Link 
            href="/" 
            className="text-xs font-light tracking-[0.2em] uppercase text-luxury-grey hover:text-luxury-noir transition-colors duration-300"
            prefetch={true}
          >
            דף הבית
          </Link>
          <Link 
            href="/products" 
            className="text-xs font-light tracking-[0.2em] uppercase text-luxury-grey hover:text-luxury-noir transition-colors duration-300"
            prefetch={true}
          >
            קטלוג
          </Link>
        </nav>

        {/* Logo Center - Company logo only, larger */}
        <Link href="/" className="flex items-center justify-center">
          <div className="relative">
            <Image
              src="/images/logo-company.png"
              alt="לוגו חברה"
              width={280}
              height={96}
              className="h-16 w-auto object-contain opacity-95"
              priority
            />
          </div>
        </Link>

        {/* Right Side - Cart & Admin */}
        <div className="w-[140px] flex items-center justify-end gap-4">
          <CartIcon />
          <Link 
            href="/admin/login" 
            className="text-[10px] font-light tracking-wide text-luxury-grey/50 hover:text-luxury-grey transition-colors duration-300"
          >
            כניסת מנהל
          </Link>
        </div>
      </div>
    </header>
  );
}
