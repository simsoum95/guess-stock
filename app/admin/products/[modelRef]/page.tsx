import { createServerClient } from "@/lib/supabase-server";
import { ProductForm } from "@/components/admin/ProductForm";
import Link from "next/link";
import { notFound } from "next/navigation";

// Always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{ modelRef: string }>;
  searchParams: Promise<{ color?: string; id?: string }>;
}

async function getProduct(modelRef: string, color: string, id?: string) {
  const supabase = createServerClient();
  
  const decodedRef = decodeURIComponent(modelRef);
  const decodedColor = decodeURIComponent(color);
  const decodedId = id ? decodeURIComponent(id) : null;
  
  console.log(`[EditProduct] Looking for: id="${decodedId}", modelRef="${decodedRef}", color="${decodedColor}"`);
  
  // Si on a l'ID, l'utiliser en priorité (plus précis)
  if (decodedId) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", decodedId)
      .single();

    if (!error && data) {
      console.log(`[EditProduct] Found by ID: ${data.id}`);
      return data;
    }
  }
  
  // Sinon, chercher par modelRef + color
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .ilike("modelRef", decodedRef)
    .ilike("color", decodedColor)
    .limit(1)
    .single();

  if (error) {
    console.log(`[EditProduct] Error: ${error.message}`);
  } else {
    console.log(`[EditProduct] Found by modelRef+color: ${data?.modelRef} / ${data?.color}`);
  }

  return data;
}

export default async function EditProductPage({ params, searchParams }: PageProps) {
  const { modelRef } = await params;
  const { color, id } = await searchParams;

  if (!color) notFound();

  const product = await getProduct(modelRef, color, id);
  if (!product) notFound();

  return (
    <div className="p-6 lg:p-8 lg:pt-8 pt-20">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6">
        <Link href="/admin/products" className="text-slate-500 hover:text-slate-700">
          רשימת מוצרים
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-medium">{product.modelRef}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">עריכת מוצר</h1>
          <p className="text-slate-500 mt-1">{product.modelRef} - {product.color}</p>
        </div>
        
        <div className="flex items-center gap-2">
          {product.stockQuantity === 0 && (
            <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
              חסר במלאי
            </span>
          )}
          {product.stockQuantity > 0 && product.stockQuantity < 5 && (
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
              מלאי נמוך
            </span>
          )}
        </div>
      </div>

      <ProductForm product={product} isEdit />
    </div>
  );
}
