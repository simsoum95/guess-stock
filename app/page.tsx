import Link from "next/link";
import Image from "next/image";
import { BrandLogo } from "@/components/BrandLogo";

export default function HomePage() {
  return (
    <main className="min-h-screen hero-bg">
      <section className="relative min-h-screen flex flex-col items-center justify-center px-12 py-16">
        {/* Logos */}
        <div className="mb-24 flex flex-col items-center justify-center gap-8 animate-fade-in-luxury">
          {/* Company Logo - Large and centered */}
          <div className="relative mb-8">
            <Image
              src="/images/logo-company.png"
              alt="לוגו חברה"
              width={720}
              height={252}
              className="h-64 w-auto object-contain opacity-95"
              priority
            />
          </div>
          
          {/* Brand Logos - Below company logo, left to right (GUESS first on left) */}
          <div className="flex flex-wrap items-center justify-center gap-12 max-w-7xl px-8 mb-8">
            <BrandLogo name="GUESS" filename="guess.jpg" />
            <BrandLogo name="SAM EDELMAN" filename="sam-edelman.png" />
            <BrandLogo name="VILEBREQUIN" filename="vilebrequin.jpg" />
            <BrandLogo name="DKNY" filename="dkny.png" />
            <BrandLogo name="BAYTON" filename="bayton.jpg" />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-8 text-center font-serif animate-fade-in-luxury" style={{ animationDelay: "0.1s" }}>
          <span className="text-luxury-title block">
            קטלוג מלאי רשמי ישראל
          </span>
        </h1>

        {/* Subtitle */}
        <p 
          className="mb-12 max-w-2xl text-center text-luxury-grey text-sm font-light leading-relaxed tracking-wide animate-fade-in-luxury"
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
