"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/fetchSheet";

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
    <main className="min-h-screen bg-brand-black text-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-2xl font-bold">קטלוג מלאי תיקים ונעליים</h1>
          <p className="text-white/60 text-sm">סה״כ פריטים: {filtered.length}</p>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חפש לפי קוד פריט..."
            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/50 focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <FilterPill
            label="כל הקטגוריות"
            active={category === "all"}
            onClick={() => setCategory("all")}
          />
          <FilterPill
            label="תיקים"
            active={category === "תיק"}
            onClick={() => setCategory("תיק")}
          />
          <FilterPill
            label="נעליים"
            active={category === "נעל"}
            onClick={() => setCategory("נעל")}
          />
          <FilterPill
            label="בגדים"
            active={category === "ביגוד"}
            onClick={() => setCategory("ביגוד")}
          />
          <div className="w-px bg-white/10" />
          <FilterPill
            label="במלאי"
            active={stock === "in"}
            onClick={() => setStock("in")}
          />
          <FilterPill
            label="חסר במלאי"
            active={stock === "out"}
            onClick={() => setStock("out")}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product, index) => (
            <ProductCard key={`${product.id}-${product.category}-${index}`} product={product} />
          ))}
        </div>
      </section>
    </main>
  );
}

function FilterPill({
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
      className={`rounded-full border px-4 py-2 text-sm transition ${
        active
          ? "border-white bg-white text-black"
          : "border-white/20 text-white/80 hover:border-white/50"
      }`}
      type="button"
    >
      {label}
    </button>
  );
}

function ProductCard({ product }: { product: Product }) {
  const out = product.stockQuantity === 0;
  const categoryLabel = product.category;
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-charcoal to-brand-gray shadow-card">
      <div className="relative h-56 w-full overflow-hidden bg-black">
        <img
          src={product.imageUrl}
          alt={product.productName}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105 group-hover:opacity-95"
        />
        {out && (
          <span className="badge-out absolute right-3 top-3 shadow-lg">
            חסר במלאי
          </span>
        )}
      </div>
      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
              {product.brand}
            </p>
            <h3 className="text-lg font-semibold">{product.productName}</h3>
            <p className="text-sm text-white/70">דגם: {product.modelRef}</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
            {categoryLabel}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-white/70">
          <span className="rounded-full bg-white/5 px-3 py-1">
            צבע: {product.color}
          </span>
          <span className="rounded-full bg-white/5 px-3 py-1">
            מידה: {product.size}
          </span>
          <span className="rounded-full bg-white/5 px-3 py-1">
            מין: {product.gender}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="text-white/60">מחיר לקמעונאי</p>
            <p className="text-base font-semibold">₪{product.priceRetail}</p>
          </div>
          <div className="text-right">
            <p className="text-white/60">מחיר לסיטונאי</p>
            <p className="text-base font-semibold">₪{product.priceWholesale}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-white/60">
          <span>
            מלאי:{" "}
            {out ? "חסר במלאי" : `${product.stockQuantity} יחידות זמינות`}
          </span>
          <span
            className={`h-2 w-2 rounded-full ${
              out ? "bg-red-500" : "bg-emerald-400"
            }`}
          />
        </div>
      </div>
    </article>
  );
}

