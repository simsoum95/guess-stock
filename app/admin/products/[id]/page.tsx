import * as fs from "fs";
import * as path from "path";
import { notFound } from "next/navigation";
import { ProductEditForm } from "./ProductEditForm";

interface Product {
  id: string;
  collection: string;
  category: string;
  subcategory: string;
  brand: string;
  modelRef: string;
  gender: string;
  supplier: string;
  color: string;
  priceRetail: number;
  priceWholesale: number;
  stockQuantity: number;
  imageUrl: string;
  gallery: string[];
  productName: string;
  size: string;
}

async function getProduct(id: string): Promise<Product | null> {
  try {
    const filePath = path.join(process.cwd(), "data", "products.json");
    const data = fs.readFileSync(filePath, "utf-8");
    const products: Product[] = JSON.parse(data);
    return products.find((p) => p.id === id) || null;
  } catch {
    return null;
  }
}

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  return (
    <div className="p-8">
      <ProductEditForm product={product} />
    </div>
  );
}







