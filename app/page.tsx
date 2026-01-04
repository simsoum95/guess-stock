import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="min-h-screen hero-bg">
      <section className="relative min-h-screen flex flex-col items-center justify-center px-12 py-32">
        {/* Logos */}
        <div className="mb-24 flex flex-col items-center justify-center gap-8 animate-fade-in-luxury">
          {/* Company Logo - Large and centered */}
          <div className="relative">
            <Image
              src="/images/logo-company.png"
              alt="לוגו חברה"
              width={720}
              height={252}
              className="h-64 w-auto object-contain opacity-95"
              priority
            />
          </div>
          
          {/* Brand Logos - Below company logo, left to right (RTL: most popular first) */}
          <div className="flex flex-wrap items-center justify-center gap-8 max-w-6xl">
            <Image
              src="/images/brands/guess.png"
              alt="GUESS"
              width={120}
              height={60}
              className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
            />
            <Image
              src="/images/brands/guess-jeans.png"
              alt="GUESS JEANS"
              width={120}
              height={60}
              className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
            />
            <Image
              src="/images/brands/sam-edelman.png"
              alt="SAM EDELMAN"
              width={120}
              height={60}
              className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
            />
            <Image
              src="/images/brands/vilebrequin.png"
              alt="VILEBREQUIN"
              width={120}
              height={60}
              className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
            />
            <Image
              src="/images/brands/dkny.png"
              alt="DKNY"
              width={120}
              height={60}
              className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
            />
            <Image
              src="/images/brands/bayton.png"
              alt="BAYTON"
              width={120}
              height={60}
              className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
            />
            <Image
              src="/images/brands/circus-ny.png"
              alt="CIRCUS NY"
              width={120}
              height={60}
              className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
            />
            <Image
              src="/images/brands/gooce.png"
              alt="GOOCE"
              width={120}
              height={60}
              className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
            />
            <Image
              src="/images/brands/pulliez.png"
              alt="PULLIEZ"
              width={120}
              height={60}
              className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
            />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-12 text-center font-serif animate-fade-in-luxury" style={{ animationDelay: "0.1s" }}>
          <span className="text-luxury-title block">
            קטלוג מלאי רשמי ישראל
          </span>
        </h1>

        {/* Subtitle */}
        <p 
          className="mb-20 max-w-2xl text-center text-luxury-grey text-sm font-light leading-relaxed tracking-wide animate-fade-in-luxury"
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
