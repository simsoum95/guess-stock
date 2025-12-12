"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

interface ProductEditFormProps {
  product: Product;
}

export function ProductEditForm({ product: initialProduct }: ProductEditFormProps) {
  const [product, setProduct] = useState(initialProduct);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const handleChange = (field: keyof Product, value: string | number) => {
    setProduct({ ...product, [field]: value });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/update-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: "success", text: "המוצר נשמר בהצלחה" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error || "שגיאה בשמירה" });
      }
    } catch {
      setMessage({ type: "error", text: "שגיאה בחיבור לשרת" });
    }

    setSaving(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/admin/products"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            חזרה לרשימה
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">עריכת מוצר</h1>
          <p className="text-gray-500 mt-1">{product.modelRef}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
        >
          {saving ? "שומר..." : "שמור שינויים"}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-3 gap-8">
        {/* Image */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 mb-4">
              <Image
                src={product.imageUrl || "/images/default.png"}
                alt={product.productName}
                fill
                className="object-cover"
              />
            </div>
            <input
              type="text"
              value={product.imageUrl}
              onChange={(e) => handleChange("imageUrl", e.target.value)}
              placeholder="כתובת תמונה"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              dir="ltr"
            />
          </div>
        </div>

        {/* Form */}
        <div className="col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">פרטים בסיסיים</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מזהה</label>
                <input
                  type="text"
                  value={product.id}
                  disabled
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מק״ט</label>
                <input
                  type="text"
                  value={product.modelRef}
                  onChange={(e) => handleChange("modelRef", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם מוצר</label>
                <input
                  type="text"
                  value={product.productName}
                  onChange={(e) => handleChange("productName", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מותג</label>
                <input
                  type="text"
                  value={product.brand}
                  onChange={(e) => handleChange("brand", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">צבע</label>
                <input
                  type="text"
                  value={product.color}
                  onChange={(e) => handleChange("color", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מידה</label>
                <input
                  type="text"
                  value={product.size}
                  onChange={(e) => handleChange("size", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">קטגוריות</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">קולקציה</label>
                <input
                  type="text"
                  value={product.collection}
                  onChange={(e) => handleChange("collection", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">קטגוריה</label>
                <input
                  type="text"
                  value={product.category}
                  onChange={(e) => handleChange("category", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תת-קטגוריה</label>
                <input
                  type="text"
                  value={product.subcategory}
                  onChange={(e) => handleChange("subcategory", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מגדר</label>
                <input
                  type="text"
                  value={product.gender}
                  onChange={(e) => handleChange("gender", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">מחירים ומלאי</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מחיר קמעונאי</label>
                <input
                  type="number"
                  value={product.priceRetail}
                  onChange={(e) => handleChange("priceRetail", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מחיר סיטונאי</label>
                <input
                  type="number"
                  value={product.priceWholesale}
                  onChange={(e) => handleChange("priceWholesale", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מלאי</label>
                <input
                  type="number"
                  value={product.stockQuantity}
                  onChange={(e) => handleChange("stockQuantity", parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Supplier */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">ספק</h2>
            <input
              type="text"
              value={product.supplier}
              onChange={(e) => handleChange("supplier", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

