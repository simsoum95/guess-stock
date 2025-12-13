"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";

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

interface ProductsTableProps {
  products: Product[];
}

export function ProductsTable({ products: initialProducts }: ProductsTableProps) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [newStock, setNewStock] = useState<number>(0);
  const [saving, setSaving] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        product.modelRef?.toLowerCase().includes(searchLower) ||
        product.productName?.toLowerCase().includes(searchLower) ||
        product.color?.toLowerCase().includes(searchLower) ||
        product.id?.toLowerCase().includes(searchLower);

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "inStock" && product.stockQuantity > 0) ||
        (stockFilter === "outOfStock" && product.stockQuantity === 0);

      return matchesSearch && matchesStock;
    });
  }, [products, search, stockFilter]);

  const handleStockUpdate = async (productId: string) => {
    setSaving(productId);
    try {
      const response = await fetch("/api/admin/update-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, stockQuantity: newStock }),
      });

      if (response.ok) {
        setProducts(products.map(p => 
          p.id === productId ? { ...p, stockQuantity: newStock } : p
        ));
        setEditingStock(null);
      } else {
        alert("שגיאה בעדכון המלאי");
      }
    } catch {
      alert("שגיאה בחיבור לשרת");
    }
    setSaving(null);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Filters */}
      <div className="p-4 border-b border-gray-200 flex gap-4">
        <input
          type="text"
          placeholder="חיפוש לפי מק״ט, שם, צבע..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm"
        />
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="all">כל המלאי</option>
          <option value="inStock">במלאי</option>
          <option value="outOfStock">אזל</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">תמונה</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מק״ט</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">שם</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">צבע</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מידה</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מחיר</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מלאי</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="w-12 h-12 relative rounded overflow-hidden bg-gray-100">
                    <Image
                      src={product.imageUrl || "/images/default.png"}
                      alt={product.productName}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/images/default.png";
                      }}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">{product.modelRef}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{product.productName || product.modelRef}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{product.color || "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{product.size || "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-900">₪{product.priceRetail?.toFixed(2)}</td>
                <td className="px-4 py-3">
                  {editingStock === product.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={newStock}
                        onChange={(e) => setNewStock(parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        min="0"
                        autoFocus
                      />
                      <button
                        onClick={() => handleStockUpdate(product.id)}
                        disabled={saving === product.id}
                        className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700"
                      >
                        {saving === product.id ? "..." : "שמור"}
                      </button>
                      <button
                        onClick={() => setEditingStock(null)}
                        className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                      >
                        ביטול
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingStock(product.id);
                        setNewStock(product.stockQuantity);
                      }}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        product.stockQuantity > 0
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-red-100 text-red-800 hover:bg-red-200"
                      }`}
                    >
                      {product.stockQuantity}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    עריכה
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
        מציג {filteredProducts.length} מתוך {products.length} מוצרים
      </div>
    </div>
  );
}







