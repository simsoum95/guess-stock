"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function HomePage() {
  return (
    <main className="min-h-screen hero-bg">
      <section className="relative min-h-screen flex flex-col items-center justify-center px-12 py-32">
        {/* Logos - Centered, Elegant */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="mb-24 flex items-center justify-center gap-16"
        >
          <div className="relative">
            <Image
              src="/images/logo-company.png"
              alt="לוגו חברה"
              width={240}
              height={84}
              className="h-20 w-auto object-contain opacity-95"
              priority
            />
          </div>
          
          <div className="h-px w-24 bg-luxury-grey/20" />
          
          <div className="relative">
            <Image
              src="/images/logo-guess.png"
              alt="Guess Logo"
              width={220}
              height={80}
              className="h-20 w-auto object-contain opacity-95"
              priority
            />
          </div>
        </motion.div>

        {/* Title - Large, Serif, Elegant */}
        <motion.h1 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="mb-12 text-center font-serif"
        >
          <span className="text-luxury-title block">
            קטלוג רשמי
          </span>
          <span className="text-luxury-title block mt-2">
            GUESS ישראל
          </span>
        </motion.h1>

        {/* Subtitle - Minimal */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="mb-20 max-w-2xl text-center text-luxury-grey text-sm font-light leading-relaxed tracking-wide"
          style={{ letterSpacing: "0.05em" }}
        >
          גישה מקצועית לכל דגמי התיקים והנעליים,
          <br />
          עם עדכון מלאי בזמן אמת
        </motion.p>

        {/* CTA Button - Minimal Luxury */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <Link 
            href="/products" 
            className="btn-luxury"
          >
            למעבר לקטלוג
          </Link>
        </motion.div>
      </section>
    </main>
  );
}
