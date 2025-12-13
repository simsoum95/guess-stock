"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ImageUploader } from "./ImageUploader";

interface Product {
  id?: string;
  modelRef: string;
  productName?: string;
  brand: string;
  color: string;
  subcategory: string;
  collection?: string;
  supplier?: string;
  gender?: string;
  priceRetail: number;
  priceWholesale: number;
  stockQuantity: number;
  imageUrl: string;
  gallery?: string[];
}

export function ProductForm({ product, isEdit = false }: { product?: Product; isEdit?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<Product>({
    modelRef: product?.modelRef || "",
    productName: product?.productName || "",
    brand: product?.brand || "GUESS",
    color: product?.color || "",
    subcategory: product?.subcategory || "תיק",
    collection: product?.collection || "",
    supplier: product?.supplier || "",
    gender: product?.gender || "Women",
    priceRetail: product?.priceRetail || 0,
    priceWholesale: product?.priceWholesale || 0,
    stockQuantity: product?.stockQuantity || 0,
    imageUrl: product?.imageUrl || "/images/default.png",
    gallery: product?.gallery || [],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleImageChange = (imageUrl: string, gallery: string[]) => {
    setForm(prev => ({ ...prev, imageUrl, gallery }));
  };

  const adjustStock = (delta: number) => {
    setForm(prev => ({
      ...prev,
      stockQuantity: Math.max(0, prev.stockQuantity + delta),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      if (isEdit && product) {
        // Utiliser l'ID si disponible (plus précis), sinon modelRef + color
        let query = supabase
          .from("products")
          .update({
            productName: form.productName,
            brand: form.brand,
            subcategory: form.subcategory,
            collection: form.collection,
            supplier: form.supplier,
            gender: form.gender,
            priceRetail: form.priceRetail,
            priceWholesale: form.priceWholesale,
            stockQuantity: form.stockQuantity,
            imageUrl: form.imageUrl,
            gallery: form.gallery,
          });

        if (product.id && product.id !== "GUESS") {
          query = query.eq("id", product.id);
        } else {
          query = query.eq("modelRef", product.modelRef).eq("color", product.color);
        }

        const { error: updateError } = await query;

        if (updateError) {
          console.error("Update error:", updateError);
          throw new Error(updateError.message);
        }
      } else {
        const { error: insertError } = await supabase
          .from("products")
          .insert({
            id: "GUESS",
            modelRef: form.modelRef,
            productName: form.productName,
            brand: form.brand,
            color: form.color,
            subcategory: form.subcategory,
            category: form.subcategory,
            collection: form.collection,
            supplier: form.supplier,
            gender: form.gender,
            priceRetail: form.priceRetail,
            priceWholesale: form.priceWholesale,
            stockQuantity: form.stockQuantity,
            imageUrl: form.imageUrl,
            gallery: form.gallery,
          });

        if (insertError) {
          console.error("Insert error:", insertError);
          throw new Error(insertError.message);
        }
      }

      router.push("/admin/products");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "אירעה שגיאה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Basic Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">פרטי מוצר</h2>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">מק״ט *</label>
                <input
                  type="text"
                  name="modelRef"
                  value={form.modelRef}
                  onChange={handleChange}
                  required
                  disabled={isEdit}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100"
                  placeholder="AB123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">שם מוצר</label>
                <input
                  type="text"
                  name="productName"
                  value={form.productName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="תיק צד אלגנטי"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">מותג</label>
                <input
                  type="text"
                  name="brand"
                  value={form.brand}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">צבע *</label>
                <input
                  type="text"
                  name="color"
                  value={form.color}
                  onChange={handleChange}
                  required
                  disabled={isEdit}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100"
                  placeholder="BLACK 001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">קטגוריה</label>
                <select
                  name="subcategory"
                  value={form.subcategory}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="תיק">תיק</option>
                  <option value="נעל">נעל</option>
                  <option value="ביגוד">ביגוד</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">מגדר</label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="Women">נשים</option>
                  <option value="Men">גברים</option>
                  <option value="Unisex">יוניסקס</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">קולקציה</label>
                <input
                  type="text"
                  name="collection"
                  value={form.collection}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ספק</label>
                <input
                  type="text"
                  name="supplier"
                  value={form.supplier}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">מחירים ומלאי</h2>
            
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">מחיר מלא (₪)</label>
                <input
                  type="number"
                  name="priceRetail"
                  value={form.priceRetail}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">מחיר סיטונאי (₪)</label>
                <input
                  type="number"
                  name="priceWholesale"
                  value={form.priceWholesale}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">מלאי</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustStock(-1)}
                    className="w-10 h-10 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <input
                    type="number"
                    name="stockQuantity"
                    value={form.stockQuantity}
                    onChange={handleChange}
                    min="0"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => adjustStock(1)}
                    className="w-10 h-10 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Image Upload */}
        <div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-6">
            <h2 className="font-semibold text-slate-900 mb-4">תמונות</h2>
            <ImageUploader
              currentImage={form.imageUrl}
              gallery={form.gallery || []}
              onImageChange={handleImageChange}
              modelRef={form.modelRef}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
        >
          {loading ? "שומר..." : isEdit ? "שמירה" : "יצירת מוצר"}
        </button>
      </div>
    </form>
  );
}
