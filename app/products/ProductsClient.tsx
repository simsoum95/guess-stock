"use client";

import { useMemo, useState, memo, useEffect } from "react";
import type { Product } from "@/lib/types";
import Image from "next/image";
import { useCart } from "@/contexts/CartContext";

export default function ProductsClient({ products }: { products: Product[] }) {
  const [brand, setBrand] = useState<string>("all");
  const [subcategory, setSubcategory] = useState<string>("all");
  const [familyName, setFamilyName] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Reset subcategory and familyName when brand changes
  const handleBrandChange = (newBrand: string) => {
    setBrand(newBrand);
    setSubcategory("all");
    setFamilyName("all");
  };

  // Get available brands from products
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    products.forEach(p => {
      if (p.brand) brands.add(p.brand);
    });
    return Array.from(brands).sort();
  }, [products]);
  
  // Get available categories (subcategories) for selected brand (only those that exist in products)
  const availableCategories = useMemo(() => {
    // Filter products by brand first
    const filteredProducts = products.filter(p => brand === "all" || p.brand === brand);
    
    // Get all unique subcategories from filtered products
    const categories = new Set<string>();
    filteredProducts.forEach(p => {
      if (p.subcategory) categories.add(p.subcategory);
    });
    return Array.from(categories).sort();
  }, [brand, products]);
  
  // Get available family names (model names) for the selected brand and subcategory
  const availableFamilyNames = useMemo(() => {
    // Show family names when a subcategory is selected OR when a specific brand is selected
    if (subcategory === "all" && brand === "all") {
      return [];
    }
    const familyNames = new Set<string>();
    products
      .filter(p => {
        // Filter by brand if selected
        if (brand !== "all" && p.brand !== brand) return false;
        // Filter by subcategory if selected
        if (subcategory !== "all" && p.subcategory !== subcategory) return false;
        // Must have a family name
        return p.familyName;
      })
      .forEach(p => familyNames.add(p.familyName!));
    return Array.from(familyNames).sort();
  }, [brand, subcategory, products]);

  const filtered = useMemo(() => {
    const result = products.filter((product) => {
      // Filter by brand (first filter)
      if (brand !== "all" && product.brand !== brand) return false;
      
      // Filter by subcategory (now called "category" in the UI)
      if (subcategory !== "all" && product.subcategory !== subcategory) return false;
      
      // Filter by family name (for bags)
      if (familyName !== "all" && product.familyName !== familyName) return false;

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
  }, [products, brand, subcategory, familyName, searchQuery]);

  return (
    <main className="min-h-screen bg-luxury-white">
      <section className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-16 py-8 sm:py-12 lg:py-20">
        {/* Header */}
        <div className="mb-4 sm:mb-6 lg:mb-8 animate-fade-in-luxury">
          <h1 className="mb-2 sm:mb-3 lg:mb-4 font-serif text-2xl sm:text-3xl lg:text-5xl font-normal tracking-tight text-luxury-noir" style={{ letterSpacing: "0.01em" }}>
            קטלוג מלאי
          </h1>
          <p className="text-xs font-light tracking-[0.2em] uppercase text-luxury-grey" style={{ letterSpacing: "0.2em" }}>
            {filtered.length} פריטים
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-4 sm:mb-5 lg:mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חפש לפי קוד פריט, דגם או שם"
            className="search-luxury text-sm sm:text-base"
          />
        </div>

        {/* Filter Controls */}
        <div className="mb-12 sm:mb-16 lg:mb-24 space-y-4 sm:space-y-6 lg:space-y-8 border-b border-luxury-grey/20 pb-4 sm:pb-6 lg:pb-8">
          {/* Brand Filters - First filter (LARGE & BOLD) */}
          {availableBrands.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 lg:gap-10">
              <FilterControl
                label="כל המותגים"
                active={brand === "all"}
                onClick={() => handleBrandChange("all")}
                size="large"
                isAllOption
              />
              {availableBrands.map((brandName) => (
                <FilterControl
                  key={brandName}
                  label={brandName}
                  active={brand === brandName}
                  onClick={() => handleBrandChange(brandName)}
                  size="large"
                />
              ))}
            </div>
          )}
          
          {/* Category Filters - Show all subcategories for selected brand (MEDIUM & SEMIBOLD) */}
          {availableCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 lg:gap-10">
              <FilterControl
                label="כל הקטגוריות"
                active={subcategory === "all"}
                onClick={() => {
                  setSubcategory("all");
                  setFamilyName("all");
                }}
                size="medium"
                isAllOption
              />
              {availableCategories.map((cat) => (
                <FilterControl
                  key={cat}
                  label={cat}
                  active={subcategory === cat}
                  onClick={() => {
                    setSubcategory(cat);
                    setFamilyName("all"); // Reset family name when category changes
                  }}
                  size="medium"
                />
              ))}
            </div>
          )}
          
          {/* Family Name Filters - NORMAL size */}
          {availableFamilyNames.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 lg:gap-6">
              <FilterControl
                label="כל המשפחות"
                active={familyName === "all"}
                onClick={() => setFamilyName("all")}
                size="normal"
                isAllOption
              />
              {availableFamilyNames.map((family) => (
                <FilterControl
                  key={family}
                  label={family}
                  active={familyName === family}
                  onClick={() => setFamilyName(family)}
                  size="normal"
                />
              ))}
            </div>
          )}
        </div>

        {/* Product Grid */}
        <div className="grid gap-4 sm:gap-6 lg:gap-10 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
  onClick,
  size = "normal",
  isAllOption = false
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  size?: "large" | "medium" | "normal";
  isAllOption?: boolean;
}) {
  const sizeClasses = {
    large: "text-base sm:text-lg lg:text-xl font-bold",
    medium: "text-sm sm:text-base font-semibold",
    normal: "text-xs sm:text-sm font-normal"
  };
  
  const allOptionClass = isAllOption ? "border-b-2 border-luxury-gold/50" : "";
  
  return (
    <button
      onClick={onClick}
      className={`filter-control ${active ? "active" : ""} ${sizeClasses[size]} ${allOptionClass}`}
      type="button"
    >
      {label}
    </button>
  );
});

const ProductCard = memo(function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const { addToCart } = useCart();
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
      <div className="relative mb-4 sm:mb-6 lg:mb-8 aspect-[3/4] w-full overflow-hidden bg-neutral-50">
        <img
          src={currentImage}
          alt={product.productName || ""}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          className={`h-full w-full ${product.category === "נעל" ? "object-contain" : "object-contain lg:group-hover:scale-105"} transition-transform duration-300 cursor-zoom-in`}
          style={product.category === "נעל" ? { padding: "1rem" } : product.category === "תיק" ? { padding: "0.5rem" } : undefined}
          onClick={(e) => {
            e.stopPropagation();
            setIsZoomed(true);
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/images/default.png";
          }}
        />
        
        {/* Overlay on Hover */}
        <div className="absolute inset-0 bg-luxury-noir/0 group-hover:bg-luxury-noir/5 transition-colors duration-300" />
        
        {/* Zoom Button */}
        <button
          onClick={() => setIsZoomed(true)}
          className="absolute bottom-2 right-2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-md z-10"
          aria-label="Zoom image"
        >
          <svg className="w-4 h-4 text-luxury-noir" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </button>

        {/* Navigation Arrows - Only show if multiple images */}
        {hasMultipleImages && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 bg-white/90 lg:bg-white/80 hover:bg-white rounded-full flex items-center justify-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 shadow-sm z-10"
              aria-label="Previous image"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-luxury-noir" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={nextImage}
              className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 bg-white/90 lg:bg-white/80 hover:bg-white rounded-full flex items-center justify-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 shadow-sm z-10"
              aria-label="Next image"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-luxury-noir" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Image Indicators - Only show if multiple images */}
        {hasMultipleImages && (
          <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 sm:gap-1.5">
            {allImages.map((_, index) => (
              <button
                key={index}
                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(index); }}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  index === currentImageIndex 
                    ? "bg-luxury-noir w-2.5 sm:w-3" 
                    : "bg-luxury-noir/30 hover:bg-luxury-noir/50"
                }`}
                aria-label={`Image ${index + 1}`}
              />
            ))}
          </div>
        )}
        
        {/* Out of Stock Badge */}
        {out && (
          <div className="absolute right-3 sm:right-4 lg:right-6 top-3 sm:top-4 lg:top-6">
            <span className="badge-out-luxury text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-0.5 sm:py-1">חסר במלאי</span>
          </div>
        )}

        {/* Image Count Badge */}
        {hasMultipleImages && (
          <div className="absolute left-2 sm:left-3 top-2 sm:top-3 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/90 lg:bg-white/80 rounded text-[9px] sm:text-[10px] font-medium text-luxury-noir opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300">
            {currentImageIndex + 1} / {allImages.length}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2 sm:space-y-3 lg:space-y-4">
        <p className="text-[10px] sm:text-xs font-light tracking-[0.15em] uppercase text-luxury-grey" style={{ letterSpacing: "0.15em" }}>
          {product.brand}
        </p>
        
        <h3 className="text-xs sm:text-sm font-light text-luxury-noir leading-relaxed tracking-wide" style={{ letterSpacing: "0.02em" }}>
          {product.category === "תיק" ? (
            <>
              {/* For bags: show bagName (model description) + itemCode */}
              <span className="font-bold">{product.bagName || product.modelRef}</span>
              {product.itemCode && (
                <span className="block text-[10px] sm:text-xs font-light text-luxury-grey tracking-wide mt-0.5 sm:mt-1" style={{ letterSpacing: "0.03em" }}>
                  {product.itemCode}
                </span>
              )}
            </>
          ) : (
            <>
              {/* For shoes: show itemCode (product code) + color - NOT the family name */}
              <span className="font-bold">{product.itemCode || product.modelRef}</span>
              {product.color && (
                <span className="block text-[10px] sm:text-xs font-light text-luxury-grey tracking-wide mt-0.5 sm:mt-1" style={{ letterSpacing: "0.03em" }}>
                  {product.color}
                </span>
              )}
            </>
          )}
        </h3>

        <div className="divider-luxury my-3 sm:my-4 lg:my-6" />

        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-light text-luxury-grey mb-1 sm:mb-2 tracking-[0.1em] uppercase" style={{ letterSpacing: "0.1em" }}>
              קמעונאי
            </p>
            <p className="text-sm sm:text-base font-light text-luxury-noir tracking-wide" style={{ letterSpacing: "0.02em" }}>
              ₪{retail.toFixed(2)}
            </p>
          </div>
          <div className="text-left">
            <p className="text-[10px] sm:text-xs font-light text-luxury-grey mb-1 sm:mb-2 tracking-[0.1em] uppercase" style={{ letterSpacing: "0.1em" }}>
              סיטונאי
            </p>
            <p className="text-xs sm:text-sm font-light text-luxury-noir tracking-wide" style={{ letterSpacing: "0.02em" }}>
              ₪{wholesale.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 sm:pt-3 lg:pt-4">
          <span className="text-[10px] sm:text-xs font-light text-luxury-grey tracking-wide" style={{ letterSpacing: "0.03em" }}>
            {out ? "חסר במלאי" : `${product.stockQuantity} יחידות`}
          </span>
          <div className={`h-1 w-1 rounded-full transition-colors duration-300 ${out ? "bg-luxury-grey/50" : "bg-luxury-noir"}`} />
        </div>

        {/* Add to Cart Button */}
        {!out && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              addToCart(product);
            }}
            className="w-full mt-2 sm:mt-3 lg:mt-4 py-2 sm:py-2.5 lg:py-3 px-3 sm:px-4 bg-luxury-noir text-luxury-white text-[10px] sm:text-xs font-light tracking-[0.15em] uppercase hover:bg-luxury-grey transition-colors duration-300"
            style={{ letterSpacing: "0.15em" }}
          >
            הוסף לעגלה
          </button>
        )}
      </div>
      
      {/* Zoom Modal */}
      {isZoomed && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsZoomed(false);
          }}
        >
          {/* Close Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsZoomed(false);
            }}
            className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors z-[110]"
            aria-label="Close zoom"
          >
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Image Counter */}
          {hasMultipleImages && (
            <div className="absolute top-4 left-4 px-4 py-2 bg-white/10 rounded-full text-white text-sm font-medium z-[110]">
              {currentImageIndex + 1} / {allImages.length}
            </div>
          )}
          
          {/* Navigation Arrows - Outside the image container */}
          {hasMultipleImages && (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors z-[110]"
                aria-label="Previous image"
              >
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors z-[110]"
                aria-label="Next image"
              >
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
          
          {/* Main Image - Centered */}
          <div 
            className="flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentImage}
              alt={product.productName || ""}
              className="max-w-[85vw] max-h-[80vh] w-auto h-auto object-contain"
              style={{ minWidth: '300px', minHeight: '300px' }}
            />
          </div>
          
          {/* Product Info in Modal */}
          <div 
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/10 rounded-lg text-center z-[110]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-white/70 text-xs tracking-widest uppercase">{product.brand}</p>
            <p className="text-white font-semibold mt-1">{product.itemCode || product.modelRef}</p>
            <p className="text-white/60 text-sm">{product.color}</p>
          </div>
        </div>
      )}
    </article>
  );
});
