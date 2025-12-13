"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

interface Product {
  id: string;
  modelRef: string;
  productName?: string;
  brand: string;
  color: string;
  subcategory: string;
  collection?: string;
  priceWholesale: number;
  priceRetail: number;
  stockQuantity: number;
  imageUrl: string;
}

export function ProductsTable({ products }: { products: Product[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [deleteModal, setDeleteModal] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const categories = useMemo(() => {
    return Array.from(new Set(products.map(p => p.subcategory).filter(Boolean)));
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.modelRef?.toLowerCase().includes(q) && 
            !p.productName?.toLowerCase().includes(q) &&
            !p.color?.toLowerCase().includes(q)) return false;
      }
      if (category !== "all" && p.subcategory !== category) return false;
      if (stockFilter === "in" && p.stockQuantity === 0) return false;
      if (stockFilter === "out" && p.stockQuantity > 0) return false;
      return true;
    });
  }, [products, search, category, stockFilter]);

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Utiliser toutes les colonnes pour être sûr de supprimer le bon produit
    let query = supabase.from("products").delete();
    
    if (deleteModal.id && deleteModal.id !== "GUESS") {
      // Si l'ID est unique, l'utiliser
      query = query.eq("id", deleteModal.id);
    } else {
      // Sinon, utiliser modelRef + color + collection
      query = query
        .eq("modelRef", deleteModal.modelRef)
        .eq("color", deleteModal.color);
      if (deleteModal.collection) {
        query = query.eq("collection", deleteModal.collection);
      }
    }
    
    await query;

    setDeleteModal(null);
    setDeleting(false);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder="חיפוש מוצר..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Category */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">כל הקטגוריות</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Stock */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">כל המלאי</option>
            <option value="in">במלאי</option>
            <option value="out">חסר</option>
          </select>
        </div>
        <p className="mt-2 text-xs text-slate-500">{filtered.length} תוצאות</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">תמונה</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">מוצר</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">קטגוריה</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">צבע</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">מחיר סיטונאי</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">מלאי</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((product, i) => (
                <tr key={`${product.modelRef}-${product.color}-${i}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100">
                      <img
                        src={product.imageUrl || "/images/default.png"}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = "/images/default.png"; }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 text-sm">{product.modelRef}</p>
                    <p className="text-xs text-slate-500">{product.brand}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                      {product.subcategory}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{product.color}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">₪{product.priceWholesale}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      product.stockQuantity === 0 ? "bg-red-100 text-red-700" :
                      product.stockQuantity < 5 ? "bg-amber-100 text-amber-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {product.stockQuantity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/admin/products/edit?id=${encodeURIComponent(product.id || '')}&modelRef=${encodeURIComponent(product.modelRef)}&color=${encodeURIComponent(product.color)}&collection=${encodeURIComponent(product.collection || '')}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="עריכה"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                      <button
                        onClick={() => setDeleteModal(product)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="מחיקה"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">לא נמצאו מוצרים</p>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl" dir="rtl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">מחיקת מוצר</h3>
                <p className="text-sm text-slate-500">{deleteModal.modelRef}</p>
              </div>
            </div>
            
            <p className="text-slate-600 text-sm mb-5">
              האם אתה בטוח שברצונך למחוק מוצר זה? פעולה זו לא ניתנת לביטול.
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                disabled={deleting}
              >
                ביטול
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "מוחק..." : "מחיקה"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
