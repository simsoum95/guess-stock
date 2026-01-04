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

  // Essayer différentes extensions si le fichier avec l'extension spécifiée n'existe pas
  const baseName = filename.replace(/\.(png|jpg|jpeg|avif|webp)$/i, '');
  const possibleExtensions = ['.png', '.jpg', '.jpeg', '.avif', '.webp'];
  
  const getImageSrc = () => {
    // Si le filename a déjà une extension, l'utiliser d'abord
    if (filename.match(/\.(png|jpg|jpeg|avif|webp)$/i)) {
      return `/images/brands/${filename}`;
    }
    // Sinon, essayer les extensions dans l'ordre
    for (const ext of possibleExtensions) {
      const testPath = `/images/brands/${baseName}${ext}`;
      // Next.js Image component gérera l'existence du fichier
      return testPath;
    }
    return `/images/brands/${filename}`;
  };

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '40px', maxHeight: '40px' }}>
      <Image
        src={getImageSrc()}
        alt={name}
        width={200}
        height={60}
        className="h-[40px] sm:h-[50px] lg:h-[60px] w-auto max-w-[120px] sm:max-w-[150px] lg:max-w-[200px] object-contain object-center opacity-80 hover:opacity-100 transition-opacity"
        style={{ width: 'auto' }}
        onError={() => setImageError(true)}
      />
    </div>
  );
}

