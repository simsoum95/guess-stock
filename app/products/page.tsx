import { fetchSheetData, type Product } from "@/lib/fetchSheet";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  const products = await fetchSheetData();
  return <ProductsClient products={products} />;
}

