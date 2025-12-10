import { fetchProducts } from "@/lib/fetchProducts";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  const products = await fetchProducts();
  return <ProductsClient products={products} />;
}

