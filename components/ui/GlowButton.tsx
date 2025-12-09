"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface GlowButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  active?: boolean;
}

export function GlowButton({
  children,
  onClick,
  className = "",
  variant = "primary",
  active = false
}: GlowButtonProps) {
  const baseStyles = "relative rounded-full font-medium transition-all duration-300 overflow-hidden";
  
  const variants = {
    primary: "btn-premium",
    secondary: active ? "filter-pill active" : "filter-pill",
    ghost: "px-4 py-2 text-white/70 hover:text-white hover:bg-white/5"
  };

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      type="button"
    >
      {children}
    </motion.button>
  );
}

