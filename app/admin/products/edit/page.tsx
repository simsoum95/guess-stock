import { createServerClient } from "@/lib/supabase-server";
import { ProductForm } from "@/components/admin/ProductForm";
import Link from "next/link";
import { notFound } from "next/navigation";

// Always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ 
    id?: string;
    modelRef?: string;
    color?: string;
    collection?: string;
  }>;
}

async function getProduct(id: string, modelRef: string, color: string, collection: string) {
  const supabase = createServerClient();
  
  console.log(`[EditProduct] Looking for: id="${id}", modelRef="${modelRef}", color="${color}", collection="${collection}"`);
  
  // Stratégie 1: Chercher avec TOUTES les colonnes (le plus précis)
  if (id && modelRef && color) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .ilike("modelRef", modelRef)
      .ilike("color", color)
      .single();

    if (!error && data) {
      console.log(`[EditProduct] Found by id+modelRef+color: ${data.id}`);
      return data;
    }
  }

  // Stratégie 2: id + modelRef + collection
  if (id && modelRef && collection) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .ilike("modelRef", modelRef)
      .ilike("collection", collection)
      .single();

    if (!error && data) {
      console.log(`[EditProduct] Found by id+modelRef+collection`);
      return data;
    }
  }

  // Stratégie 3: ID unique seul (si différent de "GUESS")
  if (id && id !== "GUESS") {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && data) {
      console.log(`[EditProduct] Found by unique id: ${data.id}`);
      return data;
    }
  }

  // Stratégie 4: modelRef + color + collection
  if (modelRef && color && collection) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .ilike("modelRef", modelRef)
      .ilike("color", color)
      .ilike("collection", collection)
      .single();

    if (!error && data) {
      console.log(`[EditProduct] Found by modelRef+color+collection`);
      return data;
    }
  }

  // Stratégie 5: modelRef + color (fallback)
  if (modelRef && color) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .ilike("modelRef", modelRef)
      .ilike("color", color)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      console.log(`[EditProduct] Found by modelRef+color (fallback)`);
      return data;
    }
  }

  console.log(`[EditProduct] NOT FOUND`);
  return null;
}

export default async function EditProductPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { id, modelRef, color, collection } = params;

  if (!modelRef || !color) {
    notFound();
  }

  const product = await getProduct(
    id || '', 
    modelRef, 
    color, 
    collection || ''
  );
  
  if (!product) {
    notFound();
  }

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
          <p className="text-xs text-slate-400 mt-1">ID: {product.id}</p>
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

