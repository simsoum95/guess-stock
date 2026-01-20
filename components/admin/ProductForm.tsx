"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUploader } from "./ImageUploader";

interface Product {
  modelRef: string;
  productName?: string;
  bagName?: string;
  itemCode?: string;
  brand: string;
  color: string;
  category?: string;
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

interface ProductFormProps {
  product?: Product;
  isEdit?: boolean;
  canEditProducts?: boolean;
  canEditImages?: boolean;
}

export function ProductForm({ product, isEdit = false, canEditProducts = true, canEditImages = true }: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<Product>({
    modelRef: product?.modelRef || "",
    productName: product?.productName || "",
    bagName: product?.bagName || "",
    itemCode: product?.itemCode || "",
    brand: product?.brand || "GUESS",
    color: product?.color || "",
    category: product?.category || "תיק",
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
    // Block changes if user doesn't have edit_products permission
    if (!canEditProducts) return;
    
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleImageChange = (imageUrl: string, gallery: string[]) => {
    // Only allow image changes if user has edit_images permission
    if (!canEditImages) return;
    setForm(prev => ({ ...prev, imageUrl, gallery }));
  };

  const adjustStock = (delta: number) => {
    if (!canEditProducts) return;
    setForm(prev => ({
      ...prev,
      stockQuantity: Math.max(0, prev.stockQuantity + delta),
    }));
  };

  // Determine if form can be submitted
  const canSubmit = canEditProducts || canEditImages;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isEdit && product) {
        // Update existing product via API
        const response = await fetch("/api/admin/products", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelRef: product.modelRef,
            originalColor: product.color,
            productName: form.productName,
            bagName: form.bagName,
            itemCode: form.itemCode,
            category: form.category,
            brand: form.brand,
            subcategory: form.subcategory,
            collection: form.collection,
            supplier: form.supplier,
            gender: form.gender,
            color: form.color,
            priceRetail: form.priceRetail,
            priceWholesale: form.priceWholesale,
            stockQuantity: form.stockQuantity,
          }),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "שגיאה בעדכון המוצר");
        }
      } else {
        // Add new product via API
        const response = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelRef: form.modelRef,
            productName: form.productName,
            brand: form.brand,
            color: form.color,
            subcategory: form.subcategory,
            collection: form.collection,
            supplier: form.supplier,
            gender: form.gender,
            priceRetail: form.priceRetail,
            priceWholesale: form.priceWholesale,
            stockQuantity: form.stockQuantity,
          }),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "שגיאה בהוספת המוצר");
        }
      }

      // Show success message and redirect
      alert("המוצר עודכן בהצלחה! התמונות יופיעו תוך דקה (עדכון קאש).");
      
      // Force hard redirect for reliable navigation
      window.location.href = "/admin/products";
    } catch (err: any) {
      setError(err.message || "אירעה שגיאה");
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
          <div className={`bg-white rounded-xl border p-5 ${!canEditProducts ? 'border-slate-300 opacity-60' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">פרטי מוצר</h2>
              {!canEditProducts && (
                <span className="text-xs text-red-500">🔒 נעול</span>
              )}
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">מק״ט *</label>
                <input
                  type="text"
                  name="modelRef"
                  value={form.modelRef}
                  onChange={handleChange}
                  required
                  disabled={isEdit || !canEditProducts}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  placeholder="AB123456"
                />
              </div>

              {form.category === "תיק" ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">תיאור דגם (שם משפחה)</label>
                    <input
                      type="text"
                      name="bagName"
                      value={form.bagName || ""}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="VIVIETTE MINI DBL ZIP CROSSBDY"
                    />
                    <p className="text-xs text-slate-500 mt-1">עבור תיקים: שם המשפחה המלא</p>
                  </div>
                  {form.itemCode && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">קוד פריט (אוטומטי)</label>
                      <input
                        type="text"
                        value={form.itemCode}
                        disabled
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-600"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">שם מוצר</label>
                  <input
                    type="text"
                    name="productName"
                    value={form.productName || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="תיק צד אלגנטי"
                  />
                </div>
              )}

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
          <div className={`bg-white rounded-xl border p-5 sticky top-6 ${!canEditImages ? 'border-slate-300 opacity-60' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">תמונות</h2>
              {!canEditImages && (
                <span className="text-xs text-red-500">🔒 נעול</span>
              )}
            </div>
            {canEditImages ? (
              <ImageUploader
                currentImage={form.imageUrl}
                gallery={form.gallery || []}
                onImageChange={handleImageChange}
                modelRef={form.modelRef}
                color={form.color}
                itemCode={form.itemCode}
              />
            ) : (
              <div className="space-y-3">
                {form.imageUrl && (
                  <img src={form.imageUrl} alt="Product" className="w-full rounded-lg" />
                )}
                <p className="text-sm text-slate-500 text-center">אין לך הרשאה לערוך תמונות</p>
              </div>
            )}
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
          disabled={loading || !canSubmit}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "שומר..." : isEdit ? "שמירה" : "יצירת מוצר"}
        </button>
      </div>
    </form>
  );
}
