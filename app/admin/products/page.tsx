import { fetchProducts } from "@/lib/fetchProducts";
import { ProductsTable } from "@/components/admin/ProductsTable";
import Link from "next/link";

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

// Cache for 30 seconds - fast navigation but fresh data for admin edits
export const revalidate = 30;

async function getProducts() {
  try {
    const products = await fetchProducts();
    // Convert to format expected by ProductsTable
    return products.map(p => ({
      modelRef: p.modelRef,
      productName: p.productName || p.modelRef,
      bagName: p.bagName, // For bags
      itemCode: p.itemCode, // Item code for all products
      brand: p.brand,
      color: p.color,
      category: p.category,
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
        <div className="flex items-center gap-3">
          {/* Google Sheets Button */}
          {GOOGLE_SHEET_ID && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                <path d="M8 15h8v2H8zm0-4h8v2H8z"/>
              </svg>
              Google Sheets
            </a>
          )}
          {/* Add Product Button */}
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
      </div>

      <ProductsTable products={products} />
    </div>
  );
}
