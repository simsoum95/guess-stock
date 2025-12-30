"use client";

import { useMemo, useState, memo, useEffect } from "react";
import type { Product } from "@/lib/types";
import Image from "next/image";

type CategoryFilter = "all" | "תיק" | "נעל";

// Sous-catégories par catégorie principale
const SUBcategoriesByCategory: Record<CategoryFilter, string[]> = {
  all: [],
  "תיק": ["ארנקים", "מזוודות", "מחזיק מפתחות", "תיק גב", "תיק נסיעות", "תיק נשיאה", "תיק ערב", "תיק צד"],
  "נעל": ["כפכפים", "נעליים שטוחו", "סניקרס", "נעלי עקב", "מגפיים"]
};

export default function ProductsClient({ products }: { products: Product[] }) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [subcategory, setSubcategory] = useState<string>("all");
  const [familyName, setFamilyName] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Reset subcategory and familyName when category changes
  const handleCategoryChange = (newCategory: CategoryFilter) => {
    setCategory(newCategory);
    setSubcategory("all");
    setFamilyName("all");
  };
  
  // Get available subcategories for current category (only those that exist in products)
  const availableSubcategories = useMemo(() => {
    if (category === "all") {
      // Get all unique subcategories from products
      const allSubcats = new Set<string>();
      products.forEach(p => {
        if (p.subcategory) allSubcats.add(p.subcategory);
      });
      return Array.from(allSubcats).sort();
    }
    // Get subcategories that both exist in SUBcategoriesByCategory AND in products
    const categorySubcats = SUBcategoriesByCategory[category] || [];
    const productSubcats = new Set<string>();
    products
      .filter(p => p.category === category && p.subcategory)
      .forEach(p => productSubcats.add(p.subcategory));
    
    // Return intersection: subcategories in both lists, sorted
    return categorySubcats.filter(subcat => productSubcats.has(subcat)).sort();
  }, [category, products]);
  
  // Get available family names for bags (only those that exist in products)
  const availableFamilyNames = useMemo(() => {
    if (category !== "תיק") {
      return [];
    }
    const familyNames = new Set<string>();
    products
      .filter(p => p.category === "תיק" && p.familyName)
      .forEach(p => familyNames.add(p.familyName!));
    return Array.from(familyNames).sort();
  }, [category, products]);

  const filtered = useMemo(() => {
    const result = products.filter((product) => {
      if (category !== "all" && product.category !== category) return false;
      
      // Filter by subcategory
      if (subcategory !== "all" && product.subcategory !== subcategory) return false;
      
      // Filter by family name (for bags)
      if (category === "תיק" && familyName !== "all" && product.familyName !== familyName) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesId = product.id.toLowerCase().includes(query);
        const matchesModelRef = product.modelRef.toLowerCase().includes(query);
        const matchesName = product.productName?.toLowerCase().includes(query) ?? false;
        const matchesItemCode = product.itemCode?.toLowerCase().includes(query) ?? false;

        if (!matchesId && !matchesModelRef && !matchesName && !matchesItemCode) return false;
      }

      return true;
    });

    // Trier : 
    // 1. Produits avec image en premier, puis sans image
    // 2. Dans chaque groupe, trier par stock décroissant (plus de stock en premier)
    return result.sort((a, b) => {
      const aHasImage = a.imageUrl && !a.imageUrl.includes("default");
      const bHasImage = b.imageUrl && !b.imageUrl.includes("default");
      
      // Règle 1 : Produits avec image en premier
      if (aHasImage && !bHasImage) return -1;
      if (!aHasImage && bHasImage) return 1;
      
      // Règle 2 : Si même statut d'image, trier par stock décroissant
      return b.stockQuantity - a.stockQuantity;
    });
  }, [products, category, subcategory, familyName, searchQuery]);

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
        <div className="mb-24 space-y-8 border-b border-luxury-grey/20 pb-8">
          {/* Main Category Filters */}
          <div className="flex flex-wrap items-center gap-10">
            <FilterControl
              label="כל הקטגוריות"
              active={category === "all"}
              onClick={() => handleCategoryChange("all")}
            />
            <FilterControl
              label="תיקים"
              active={category === "תיק"}
              onClick={() => handleCategoryChange("תיק")}
            />
            <FilterControl
              label="נעליים"
              active={category === "נעל"}
              onClick={() => handleCategoryChange("נעל")}
            />
          </div>
          
          {/* Family Name Filters - Only show for bags */}
          {category === "תיק" && availableFamilyNames.length > 0 && (
            <div className="flex flex-wrap items-center gap-6">
              <FilterControl
                label="כל המשפחות"
                active={familyName === "all"}
                onClick={() => setFamilyName("all")}
              />
              {availableFamilyNames.map((family) => (
                <FilterControl
                  key={family}
                  label={family}
                  active={familyName === family}
                  onClick={() => setFamilyName(family)}
                />
              ))}
            </div>
          )}
          
          {/* Subcategory Filters - Only show if a category is selected */}
          {category !== "all" && availableSubcategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-6">
              <FilterControl
                label="כל התת-קטגוריות"
                active={subcategory === "all"}
                onClick={() => setSubcategory("all")}
              />
              {availableSubcategories.map((subcat) => (
                <FilterControl
                  key={subcat}
                  label={subcat}
                  active={subcategory === subcat}
                  onClick={() => setSubcategory(subcat)}
                />
              ))}
            </div>
          )}
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
          className={`h-full w-full ${product.category === "נעל" ? "object-contain" : "object-cover group-hover:scale-105"} transition-transform duration-300`}
          style={product.category === "נעל" ? { padding: "2rem" } : undefined}
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
          {product.category === "תיק" && product.bagName ? (
            <>
              <span className="font-bold">{product.bagName}</span>
              {product.itemCode && (
                <span className="block text-xs font-light text-luxury-grey tracking-wide mt-1" style={{ letterSpacing: "0.03em" }}>
                  {product.itemCode}
                </span>
              )}
            </>
          ) : (
            product.productName
          )}
        </h3>
        
        {product.category !== "תיק" && (
          <p className="text-xs font-light text-luxury-grey tracking-wide" style={{ letterSpacing: "0.03em" }}>
            {product.modelRef}
          </p>
        )}

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
