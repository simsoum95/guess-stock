import * as fs from "fs";
import * as path from "path";
import { ProductsTable } from "./ProductsTable";

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

async function getProducts(): Promise<Product[]> {
  try {
    const filePath = path.join(process.cwd(), "data", "products.json");
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading products:", error);
    return [];
  }
}

export default async function AdminProductsPage() {
  const products = await getProducts();

  // Stats
  const totalProducts = products.length;
  const inStock = products.filter((p) => p.stockQuantity > 0).length;
  const outOfStock = products.filter((p) => p.stockQuantity === 0).length;
  const totalStock = products.reduce((sum, p) => sum + p.stockQuantity, 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">ניהול מוצרים</h1>
        <p className="text-gray-500 mt-1">צפייה ועריכת כל המוצרים במערכת</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <p className="text-3xl font-bold text-gray-900">{totalProducts}</p>
          <p className="text-sm text-gray-500">סה״כ מוצרים</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <p className="text-3xl font-bold text-emerald-600">{inStock}</p>
          <p className="text-sm text-gray-500">במלאי</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <p className="text-3xl font-bold text-red-600">{outOfStock}</p>
          <p className="text-sm text-gray-500">אזל מהמלאי</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <p className="text-3xl font-bold text-blue-600">{totalStock}</p>
          <p className="text-sm text-gray-500">יחידות במלאי</p>
        </div>
      </div>

      {/* Products Table */}
      <ProductsTable products={products} />
    </div>
  );
}

