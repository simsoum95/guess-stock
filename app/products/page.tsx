import { fetchProducts } from "@/lib/fetchProducts";
import ProductsClient from "./ProductsClient";

// Disable cache - always fetch fresh data from Supabase
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProductsPage() {
  const products = await fetchProducts();
  return <ProductsClient products={products} />;
}

