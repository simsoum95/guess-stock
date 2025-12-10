import { ProductForm } from "@/components/admin/ProductForm";
import Link from "next/link";

export default function NewProductPage() {
  return (
    <div className="p-6 lg:p-8 lg:pt-8 pt-20">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6">
        <Link href="/admin/products" className="text-slate-500 hover:text-slate-700">
          רשימת מוצרים
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-medium">מוצר חדש</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">הוספת מוצר</h1>
        <p className="text-slate-500 mt-1">יצירת פריט חדש בקטלוג</p>
      </div>

      <ProductForm />
    </div>
  );
}
