import { fetchProducts } from "@/lib/fetchProducts";
import { ProductsTable } from "@/components/admin/ProductsTable";
import Link from "next/link";

// Always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getProducts() {
  try {
    const products = await fetchProducts();
    // Convert to format expected by ProductsTable
    return products.map(p => ({
      modelRef: p.modelRef,
      productName: p.productName || p.modelRef,
      brand: p.brand,
      color: p.color,
      subcategory: p.subcategory,
      priceWholesale: p.priceWholesale,
      priceRetail: p.priceRetail,
      stockQuantity: p.stockQuantity,
      imageUrl: p.imageUrl,
    }));
  } catch (error) {
    console.error("[AdminProductsPage] Error fetching products:", error);
    return [];
  }
}

export default async function AdminProductsPage() {
  const products = await getProducts();

  return (
    <div className="p-6 lg:p-8 lg:pt-8 pt-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">רשימת מוצרים</h1>
          <p className="text-slate-500 mt-1">{products.length} מוצרים בקטלוג</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          הוסף מוצר
        </Link>
      </div>

      <ProductsTable products={products} />
    </div>
  );
}
