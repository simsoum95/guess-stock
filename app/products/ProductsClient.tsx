"use client";

import { useState, useMemo } from "react";
import Image from "next/image";

interface Product {
  id: string;
  collection: string;
  category: string;
  subcategory: string;
  brand: string;
  modelRef: string;
  gender: string;
  supplier: string;
  color: string;
  priceRetail: number;
  priceWholesale: number;
  stockQuantity: number;
  imageUrl: string;
  gallery: string[];
  productName: string;
  size: string;
}

interface ProductsClientProps {
  products: Product[];
}

export function ProductsClient({ products }: ProductsClientProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");

  // Extraire les catégories uniques
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [products]);

  // Filtrer les produits
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Recherche
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        product.modelRef?.toLowerCase().includes(searchLower) ||
        product.productName?.toLowerCase().includes(searchLower) ||
        product.color?.toLowerCase().includes(searchLower) ||
        product.id?.toLowerCase().includes(searchLower);

      // Catégorie
      const matchesCategory =
        categoryFilter === "all" || product.category === categoryFilter;

      // Stock
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "inStock" && product.stockQuantity > 0) ||
        (stockFilter === "outOfStock" && product.stockQuantity === 0);

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, search, categoryFilter, stockFilter]);

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-serif text-gray-900 mb-2">קטלוג מוצרים</h1>
          <p className="text-gray-500 text-sm">
            {filteredProducts.length} מוצרים מתוך {products.length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-100 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <input
                type="text"
                placeholder="חיפוש לפי מק״ט, שם, צבע..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="all">כל הקטגוריות</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Stock Filter */}
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="all">כל המלאי</option>
              <option value="inStock">במלאי</option>
              <option value="outOfStock">אזל</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">לא נמצאו מוצרים</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ProductCard({ product }: { product: Product }) {
  const [imgError, setImgError] = useState(false);

  const imageUrl =
    imgError || !product.imageUrl
      ? "/images/default.png"
      : product.imageUrl;

  return (
    <div className="group">
      {/* Image */}
      <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden mb-3 relative">
        <Image
          src={imageUrl}
          alt={product.productName || product.modelRef}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          onError={() => setImgError(true)}
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
        />
        
        {/* Stock Badge */}
        {product.stockQuantity === 0 && (
          <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs text-gray-600">
            אזל מהמלאי
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-1">
        <p className="text-xs text-gray-400 font-mono">{product.modelRef}</p>
        <p className="text-sm text-gray-900 font-medium truncate">
          {product.productName || product.modelRef}
        </p>
        <p className="text-xs text-gray-500">{product.color}</p>
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm font-semibold text-gray-900">
            ₪{product.priceRetail?.toFixed(2)}
          </p>
          <p className={`text-xs ${product.stockQuantity > 0 ? "text-emerald-600" : "text-gray-400"}`}>
            {product.stockQuantity > 0 ? `${product.stockQuantity} במלאי` : "אזל"}
          </p>
        </div>
      </div>
    </div>
  );
}
