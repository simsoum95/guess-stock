"use client";

import Image from "next/image";
import { useState } from "react";

interface BrandLogoProps {
  name: string;
  filename: string;
}

export function BrandLogo({ name, filename }: BrandLogoProps) {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <span className="text-sm font-light text-luxury-grey whitespace-nowrap">
        {name}
      </span>
    );
  }

  return (
    <Image
      src={`/images/brands/${filename}`}
      alt={name}
      width={120}
      height={60}
      className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
      onError={() => setImageError(true)}
    />
  );
}

