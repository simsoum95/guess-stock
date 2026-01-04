"use client";

import Image from "next/image";
import Link from "next/link";
import { CartIcon } from "./CartIcon";
import { useState } from "react";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-luxury-white/98 backdrop-blur-sm border-b border-luxury-grey/10">
      <div className="mx-auto max-w-[1800px] flex items-center justify-between px-4 sm:px-6 lg:px-12 py-4 sm:py-6 lg:py-8">
        {/* Navigation Left - Desktop */}
        <nav className="hidden lg:flex items-center gap-10">
          <Link 
            href="/" 
            className="text-sm font-medium tracking-[0.15em] uppercase text-luxury-noir hover:text-luxury-grey transition-colors duration-300"
            prefetch={true}
          >
            דף הבית
          </Link>
          <Link 
            href="/products" 
            className="text-sm font-medium tracking-[0.15em] uppercase text-luxury-noir hover:text-luxury-grey transition-colors duration-300"
            prefetch={true}
          >
            קטלוג
          </Link>
        </nav>

        {/* Hamburger Menu - Mobile */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden w-8 h-8 flex flex-col justify-center gap-1.5"
          aria-label="תפריט"
        >
          <span className={`block h-0.5 w-full bg-luxury-noir transition-all duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block h-0.5 w-full bg-luxury-noir transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-full bg-luxury-noir transition-all duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-luxury-white border-b border-luxury-grey/10 lg:hidden">
            <nav className="flex flex-col px-4 py-4 gap-4">
              <Link 
                href="/" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium tracking-wide uppercase text-luxury-noir hover:text-luxury-grey transition-colors duration-300 py-2"
                prefetch={true}
              >
                דף הבית
              </Link>
              <Link 
                href="/products" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium tracking-wide uppercase text-luxury-noir hover:text-luxury-grey transition-colors duration-300 py-2"
                prefetch={true}
              >
                קטלוג
              </Link>
            </nav>
          </div>
        )}

        {/* Logo Center - Company logo only, larger */}
        <Link href="/" className="flex items-center justify-center">
          <div className="relative">
            <Image
              src="/images/logo-company.png"
              alt="לוגו חברה"
              width={280}
              height={96}
              className="h-10 sm:h-12 lg:h-16 w-auto object-contain opacity-95"
              priority
            />
          </div>
        </Link>

        {/* Right Side - Cart & Admin */}
        <div className="w-auto sm:w-[140px] flex items-center justify-end gap-2 sm:gap-4">
          <CartIcon />
          <Link 
            href="/admin/login" 
            className="hidden sm:block text-xs font-medium tracking-wide text-luxury-grey hover:text-luxury-noir transition-colors duration-300"
          >
            כניסת מנהל
          </Link>
        </div>
      </div>
    </header>
  );
}
