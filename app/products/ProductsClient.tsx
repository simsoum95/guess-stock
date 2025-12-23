"use client";

import { useMemo, useState, memo, useEffect } from "react";
import type { Product } from "@/lib/types";
import Image from "next/image";

type CategoryFilter = "all" | "תיק" | "נעל" | "ביגוד";
type StockFilter = "all" | "in" | "out";

export default function ProductsClient({ products }: { products: Product[] }) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filtered = useMemo(() => {
    const result = products.filter((product) => {
      if (category !== "all" && product.category !== category) return false;

      const stockOk =
        stock === "all" ||
        (stock === "in" && product.stockQuantity > 0) ||
        (stock === "out" && product.stockQuantity === 0);
      if (!stockOk) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesId = product.id.toLowerCase().includes(query);
        const matchesModelRef = product.modelRef.toLowerCase().includes(query);
        const matchesName = product.productName?.toLowerCase().includes(query) ?? false;

        if (!matchesId && !matchesModelRef && !matchesName) return false;
      }

      return true;
    });

    // Trier : produits avec image en premier, puis sans image
    return result.sort((a, b) => {
      const aHasImage = a.imageUrl && !a.imageUrl.includes("default");
      const bHasImage = b.imageUrl && !b.imageUrl.includes("default");
      if (aHasImage && !bHasImage) return -1;
      if (!aHasImage && bHasImage) return 1;
      return 0;
    });
  }, [products, category, stock, searchQuery]);

  return (
    <main className="min-h-screen bg-luxury-white">
      <section className="mx-auto max-w-[1800px] px-16 py-20">
        {/* Header */}
        <div className="mb-8 animate-fade-in-luxury">
          <h1 className="mb-4 font-serif text-5xl font-normal tracking-tight text-luxury-noir" style={{ letterSpacing: "0.01em" }}>
            קטלוג מלאי
          </h1>
          <p className="text-xs font-light tracking-[0.2em] uppercase text-luxury-grey" style={{ letterSpacing: "0.2em" }}>
            {filtered.length} פריטים
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חפש לפי קוד פריט, דגם או שם"
            className="search-luxury"
          />
        </div>

        {/* Filter Controls */}
        <div className="mb-24 flex flex-wrap items-center gap-12 border-b border-luxury-grey/20 pb-8">
          <div className="flex items-center gap-10">
            <FilterControl
              label="כל הקטגוריות"
              active={category === "all"}
              onClick={() => setCategory("all")}
            />
            <FilterControl
              label="תיקים"
              active={category === "תיק"}
              onClick={() => setCategory("תיק")}
            />
            <FilterControl
              label="נעליים"
              active={category === "נעל"}
              onClick={() => setCategory("נעל")}
            />
            <FilterControl
              label="בגדים"
              active={category === "ביגוד"}
              onClick={() => setCategory("ביגוד")}
            />
          </div>
          
          <div className="h-8 w-px bg-luxury-grey/20" />
          
          <div className="flex items-center gap-10">
            <FilterControl
              label="הכל"
              active={stock === "all"}
              onClick={() => setStock("all")}
            />
            <FilterControl
              label="במלאי"
              active={stock === "in"}
              onClick={() => setStock("in")}
            />
            <FilterControl
              label="חסר במלאי"
              active={stock === "out"}
              onClick={() => setStock("out")}
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product, index) => (
            <ProductCard 
              key={`${product.modelRef}-${product.color}-${index}`} 
              product={product}
              priority={index < 8}
            />
          ))}
        </div>

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className="py-40 text-center">
            {products.length === 0 ? (
              <>
                <p className="text-lg font-medium text-luxury-noir mb-2">
                  לא נמצאו מוצרים
                </p>
                <p className="text-sm font-light text-luxury-grey tracking-wide" style={{ letterSpacing: "0.05em" }}>
                  ייתכן שהגיליון האלקטרוני ריק או שאין גישה אליו.
                </p>
                <p className="text-xs text-luxury-grey mt-4">
                  בדוק את המשתנים הסביבה ב-Vercel Settings
                </p>
              </>
            ) : (
              <p className="text-sm font-light text-luxury-grey tracking-wide" style={{ letterSpacing: "0.05em" }}>
                לא נמצאו מוצרים התואמים לחיפוש או לפילטרים
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

const FilterControl = memo(function FilterControl({
  label,
  active = false,
  onClick
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`filter-control ${active ? "active" : ""}`}
      type="button"
    >
      {label}
    </button>
  );
});

const ProductCard = memo(function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const out = product.stockQuantity === 0;
  const retail = Number(product.priceRetail);
  const wholesale = Number(product.priceWholesale);

  // Build images array: prioritize image ending with "PZ", then "F", then others (limit to 6 for speed)
  const allImages = useMemo(() => {
    const all = [product.imageUrl, ...(product.gallery || [])].filter(
      (img) => img && !img.includes("default")
    );
    
    // Remove duplicates
    const unique = Array.from(new Set(all));
    
    // Helper function to extract filename from URL
    const getFileName = (url: string) => {
      try {
        const parts = url.split('/');
        return parts[parts.length - 1].toLowerCase();
      } catch {
        return '';
      }
    };
    
    // Helper function to check if filename ends with "PZ" (before extension)
    const endsWithPZ = (url: string) => {
      const fileName = getFileName(url);
      return /pz\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
    };
    
    // Helper function to check if filename ends with "F" (before extension)
    const endsWithF = (url: string) => {
      const fileName = getFileName(url);
      return /f\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
    };
    
    // Sort with priority: PZ first, then F (if no PZ), then others
    const sorted = unique.sort((a, b) => {
      const aIsPZ = endsWithPZ(a);
      const bIsPZ = endsWithPZ(b);
      
      // Priority 1: PZ images first
      if (aIsPZ && !bIsPZ) return -1;
      if (!aIsPZ && bIsPZ) return 1;
      
      // Priority 2: If no PZ in list, prioritize F images
      const hasAnyPZ = unique.some(url => endsWithPZ(url));
      if (!hasAnyPZ) {
        const aIsF = endsWithF(a);
        const bIsF = endsWithF(b);
        if (aIsF && !bIsF) return -1;
        if (!aIsF && bIsF) return 1;
      }
      
      return 0; // Keep original order for others
    });
    
    return sorted.slice(0, 6);
  }, [product.imageUrl, product.gallery]);
  
  const hasMultipleImages = allImages.length > 1;
  const currentImage = allImages[currentImageIndex] || product.imageUrl || "/images/default.png";
  
  // Preload next/previous images for instant carousel switching
  useEffect(() => {
    if (hasMultipleImages && typeof document !== 'undefined') {
      const nextImageUrl = allImages[(currentImageIndex + 1) % allImages.length];
      const prevImageUrl = allImages[(currentImageIndex - 1 + allImages.length) % allImages.length];
      
      // Preload next image
      if (nextImageUrl) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'image';
        link.href = nextImageUrl;
        if (!document.querySelector(`link[href="${nextImageUrl}"]`)) {
          document.head.appendChild(link);
        }
      }
      
      // Preload previous image
      if (prevImageUrl && prevImageUrl !== nextImageUrl) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'image';
        link.href = prevImageUrl;
        if (!document.querySelector(`link[href="${prevImageUrl}"]`)) {
          document.head.appendChild(link);
        }
      }
    }
  }, [currentImageIndex, allImages, hasMultipleImages]);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  return (
    <article className="product-card-luxury group">
      {/* Image Container */}
      <div className="relative mb-8 aspect-[3/4] w-full overflow-hidden bg-neutral-50">
        <img
          src={currentImage}
          alt={product.productName || ""}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/images/default.png";
          }}
        />
        
        {/* Overlay on Hover */}
        <div className="absolute inset-0 bg-luxury-noir/0 group-hover:bg-luxury-noir/5 transition-colors duration-300" />

        {/* Navigation Arrows - Only show if multiple images */}
        {hasMultipleImages && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-sm"
              aria-label="Previous image"
            >
              <svg className="w-4 h-4 text-luxury-noir" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-sm"
              aria-label="Next image"
            >
              <svg className="w-4 h-4 text-luxury-noir" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Image Indicators - Only show if multiple images */}
        {hasMultipleImages && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {allImages.map((_, index) => (
              <button
                key={index}
                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(index); }}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  index === currentImageIndex 
                    ? "bg-luxury-noir w-3" 
                    : "bg-luxury-noir/30 hover:bg-luxury-noir/50"
                }`}
                aria-label={`Image ${index + 1}`}
              />
            ))}
          </div>
        )}
        
        {/* Out of Stock Badge */}
        {out && (
          <div className="absolute right-6 top-6">
            <span className="badge-out-luxury">חסר במלאי</span>
          </div>
        )}

        {/* Image Count Badge */}
        {hasMultipleImages && (
          <div className="absolute left-3 top-3 px-2 py-1 bg-white/80 rounded text-[10px] font-medium text-luxury-noir opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {currentImageIndex + 1} / {allImages.length}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-4">
        <p className="text-xs font-light tracking-[0.15em] uppercase text-luxury-grey" style={{ letterSpacing: "0.15em" }}>
          {product.brand}
        </p>
        
        <h3 className="text-sm font-light text-luxury-noir leading-relaxed tracking-wide" style={{ letterSpacing: "0.02em" }}>
          {product.productName}
        </h3>
        
        <p className="text-xs font-light text-luxury-grey tracking-wide" style={{ letterSpacing: "0.03em" }}>
          {product.modelRef}
        </p>

        <div className="divider-luxury my-6" />

        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs font-light text-luxury-grey mb-2 tracking-[0.1em] uppercase" style={{ letterSpacing: "0.1em" }}>
              קמעונאי
            </p>
            <p className="text-base font-light text-luxury-noir tracking-wide" style={{ letterSpacing: "0.02em" }}>
              ₪{retail.toFixed(2)}
            </p>
          </div>
          <div className="text-left">
            <p className="text-xs font-light text-luxury-grey mb-2 tracking-[0.1em] uppercase" style={{ letterSpacing: "0.1em" }}>
              סיטונאי
            </p>
            <p className="text-sm font-light text-luxury-noir tracking-wide" style={{ letterSpacing: "0.02em" }}>
              ₪{wholesale.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <span className="text-xs font-light text-luxury-grey tracking-wide" style={{ letterSpacing: "0.03em" }}>
            {out ? "חסר במלאי" : `${product.stockQuantity} יחידות`}
          </span>
          <div className={`h-1 w-1 rounded-full transition-colors duration-300 ${out ? "bg-luxury-grey/50" : "bg-luxury-noir"}`} />
        </div>
      </div>
    </article>
  );
});
