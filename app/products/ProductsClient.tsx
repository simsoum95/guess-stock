"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/fetchSheet";
import { motion, AnimatePresence } from "framer-motion";

type CategoryFilter = "all" | "תיק" | "נעל" | "ביגוד";
type StockFilter = "all" | "in" | "out";

export default function ProductsClient({ products }: { products: Product[] }) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filtered = useMemo(() => {
    return products.filter((product) => {
      // Filtre catégorie : correspondance exacte en hébreu
      if (category !== "all" && product.category !== category) return false;

      // Stock filter
      const stockOk =
        stock === "all" ||
        (stock === "in" && product.stockQuantity > 0) ||
        (stock === "out" && product.stockQuantity === 0);
      if (!stockOk) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesId = product.id.toLowerCase().includes(query);
        const matchesModelRef = product.modelRef.toLowerCase().includes(query);
        const matchesName = product.productName?.toLowerCase().includes(query) ?? false;

        if (!matchesId && !matchesModelRef && !matchesName) return false;
      }

      return true;
    });
  }, [products, category, stock, searchQuery]);

  return (
    <main className="min-h-screen bg-luxury-white">
      <section className="mx-auto max-w-[1800px] px-16 py-20">
        {/* Header - Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="mb-20"
        >
          <h1 className="mb-4 font-serif text-5xl font-normal tracking-tight text-luxury-noir" style={{ letterSpacing: "0.01em" }}>
            קטלוג מלאי
          </h1>
          <p className="text-xs font-light tracking-[0.2em] uppercase text-luxury-grey" style={{ letterSpacing: "0.2em" }}>
            {filtered.length} פריטים
          </p>
        </motion.div>

        {/* Search Bar - Ultra Minimal */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          className="mb-16"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חפש לפי קוד פריט, דגם או שם"
            className="search-luxury"
          />
        </motion.div>

        {/* Filter Controls - Chanel Style */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="mb-24 flex flex-wrap items-center gap-12 border-b border-luxury-grey/20 pb-8"
        >
          {/* Category Filters */}
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
          
          {/* Divider - Thin */}
          <div className="h-8 w-px bg-luxury-grey/20" />
          
          {/* Stock Filters */}
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
        </motion.div>

        {/* Product Grid - Fashion Catalog */}
        <motion.div 
          layout
          className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((product, index) => (
              <ProductCard 
                key={`${product.id}-${product.category}-${index}`} 
                product={product} 
                index={index}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Empty State */}
        {filtered.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-40 text-center"
          >
            <p className="text-sm font-light text-luxury-grey tracking-wide" style={{ letterSpacing: "0.05em" }}>
              לא נמצאו מוצרים התואמים לחיפוש
            </p>
          </motion.div>
        )}
      </section>
    </main>
  );
}

function FilterControl({
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
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  const out = product.stockQuantity === 0;
  const categoryLabel = product.category;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ 
        duration: 0.6,
        delay: index * 0.03,
        ease: [0.4, 0, 0.2, 1],
        layout: { duration: 0.4 }
      }}
      className="product-card-luxury group"
    >
      {/* Image Container - Hero */}
      <div className="relative mb-8 aspect-[3/4] w-full overflow-hidden bg-luxury-white">
        <motion.img
          src={product.imageUrl}
          alt={product.productName}
          className="h-full w-full object-cover"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        />
        
        {/* Overlay on Hover - Subtle Darkening */}
        <div className="absolute inset-0 bg-luxury-noir/0 group-hover:bg-luxury-noir/5 transition-colors duration-600" />
        
        {/* Out of Stock Badge - Minimal */}
        {out && (
          <div className="absolute right-6 top-6">
            <span className="badge-out-luxury">
              חסר במלאי
            </span>
          </div>
        )}
      </div>

      {/* Content - Minimal Text Hierarchy */}
      <div className="space-y-4">
        {/* Brand - Subtle */}
        <p className="text-xs font-light tracking-[0.15em] uppercase text-luxury-grey" style={{ letterSpacing: "0.15em" }}>
          {product.brand}
        </p>
        
        {/* Product Name */}
        <h3 className="text-sm font-light text-luxury-noir leading-relaxed tracking-wide" style={{ letterSpacing: "0.02em" }}>
          {product.productName}
        </h3>
        
        {/* Model Ref - Minimal */}
        <p className="text-xs font-light text-luxury-grey tracking-wide" style={{ letterSpacing: "0.03em" }}>
          {product.modelRef}
        </p>

        {/* Divider - Ultra Thin */}
        <div className="divider-luxury my-6" />

        {/* Prices - Clean Luxury Spacing */}
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs font-light text-luxury-grey mb-2 tracking-[0.1em] uppercase" style={{ letterSpacing: "0.1em" }}>
              קמעונאי
            </p>
            <p className="text-base font-light text-luxury-noir tracking-wide" style={{ letterSpacing: "0.02em" }}>
              ₪{product.priceRetail}
            </p>
          </div>
          <div className="text-left">
            <p className="text-xs font-light text-luxury-grey mb-2 tracking-[0.1em] uppercase" style={{ letterSpacing: "0.1em" }}>
              סיטונאי
            </p>
            <p className="text-sm font-light text-luxury-noir tracking-wide" style={{ letterSpacing: "0.02em" }}>
              ₪{product.priceWholesale}
            </p>
          </div>
        </div>

        {/* Stock - Minimal Indicator */}
        <div className="flex items-center justify-between pt-4">
          <span className="text-xs font-light text-luxury-grey tracking-wide" style={{ letterSpacing: "0.03em" }}>
            {out ? "חסר במלאי" : `${product.stockQuantity} יחידות`}
          </span>
          <div className={`h-1 w-1 rounded-full transition-colors duration-300 ${out ? "bg-luxury-grey/50" : "bg-luxury-noir"}`} />
        </div>
      </div>
    </motion.article>
  );
}
