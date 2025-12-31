import { fetchProducts } from "@/lib/fetchProducts";
import { ProductForm } from "@/components/admin/ProductForm";
import Link from "next/link";
import { notFound } from "next/navigation";

// Always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{ modelRef: string }>;
  searchParams: Promise<{ color?: string }>;
}

async function getProduct(modelRef: string, color: string) {
  const products = await fetchProducts();
  const product = products.find(
    p => p.modelRef === decodeURIComponent(modelRef) && 
         p.color === decodeURIComponent(color)
  );
  
  if (!product) return null;

  // Convert to format expected by ProductForm
  return {
    modelRef: product.modelRef,
    productName: product.productName,
    bagName: product.bagName, // For bags
    itemCode: product.itemCode, // Item code
    brand: product.brand,
    color: product.color,
    category: product.category,
    subcategory: product.subcategory,
    collection: product.collection,
    supplier: product.supplier,
    gender: product.gender,
    priceRetail: product.priceRetail,
    priceWholesale: product.priceWholesale,
    stockQuantity: product.stockQuantity,
    imageUrl: product.imageUrl,
    gallery: product.gallery || [],
  };
}

export default async function EditProductPage({ params, searchParams }: PageProps) {
  const { modelRef } = await params;
  const { color } = await searchParams;

  if (!color) notFound();

  const product = await getProduct(modelRef, color);
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
          <p className="text-slate-500 mt-1">
            {product.bagName || product.productName || product.modelRef}
            {product.itemCode && ` (${product.itemCode})`} - {product.color}
          </p>
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
