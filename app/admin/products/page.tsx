import { fetchProducts } from "@/lib/fetchProducts";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { ProductsHeader } from "./ProductsHeader";

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
      {/* Header with permission-based buttons */}
      <ProductsHeader 
        productCount={products.length} 
        googleSheetId={GOOGLE_SHEET_ID} 
      />

      <ProductsTable products={products} />
    </div>
  );
}
