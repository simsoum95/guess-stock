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

        {/* Logos Center */}
        <Link href="/" className="flex items-center gap-8">
          <div className="relative">
            <Image
              src="/images/logo-company.png"
              alt="לוגו חברה"
              width={140}
              height={48}
              className="h-12 w-auto object-contain opacity-95"
              priority
            />
          </div>
          
          <div className="h-px w-12 bg-luxury-grey/30" />
          
          <div className="relative">
            <Image
              src="/images/logo-guess.png"
              alt="Guess Logo"
              width={120}
              height={44}
              className="h-11 w-auto object-contain opacity-95"
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
