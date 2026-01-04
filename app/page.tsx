import Link from "next/link";
import Image from "next/image";
import { BrandLogo } from "@/components/BrandLogo";

export default function HomePage() {
  return (
    <main className="min-h-screen hero-bg">
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-8 lg:px-12 py-8 sm:py-12 lg:py-16">
        {/* Logos */}
        <div className="mb-12 sm:mb-16 lg:mb-24 flex flex-col items-center justify-center gap-4 sm:gap-6 lg:gap-8 animate-fade-in-luxury">
          {/* Company Logo - Large and centered */}
          <div className="relative mb-4 sm:mb-6 lg:mb-8">
            <Image
              src="/images/logo-company.png"
              alt="לוגו חברה"
              width={720}
              height={252}
              className="h-32 sm:h-48 lg:h-64 w-auto object-contain opacity-95"
              priority
            />
          </div>
          
          {/* Brand Logos - Below company logo, left to right (GUESS first on left) */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 lg:gap-12 max-w-7xl px-4 sm:px-6 lg:px-8 mb-4 sm:mb-6 lg:mb-8">
            <BrandLogo name="GUESS" filename="guess.jpg" />
            <BrandLogo name="SAM EDELMAN" filename="sam-edelman.png" />
            <BrandLogo name="VILEBREQUIN" filename="vilebrequin.jpg" />
            <BrandLogo name="DKNY" filename="dkny.png" />
            <BrandLogo name="BAYTON" filename="bayton.jpg" />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-4 sm:mb-6 lg:mb-8 text-center font-serif animate-fade-in-luxury" style={{ animationDelay: "0.1s" }}>
          <span className="text-luxury-title block text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
            קטלוג מלאי רשמי ישראל
          </span>
        </h1>

        {/* Subtitle */}
        <p 
          className="mb-6 sm:mb-8 lg:mb-12 max-w-2xl text-center text-luxury-grey text-xs sm:text-sm font-light leading-relaxed tracking-wide animate-fade-in-luxury px-4"
          style={{ letterSpacing: "0.05em", animationDelay: "0.2s" }}
        >
          גישה מקצועית לכל דגמי התיקים והנעליים,
          <br />
          עם עדכון מלאי בזמן אמת
        </p>

        {/* CTA Button */}
        <div className="animate-fade-in-luxury" style={{ animationDelay: "0.3s" }}>
          <Link 
            href="/products" 
            className="btn-luxury"
            prefetch={true}
          >
            למעבר לקטלוג
          </Link>
        </div>
      </section>
    </main>
  );
}
