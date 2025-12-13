import { supabase } from "./supabase";
import type { Product, Category } from "./types";

const categoryMap: Record<string, Category> = {
  "תיק": "תיק",
  "נעל": "נעל",
  "ביגוד": "ביגוד"
};

function normalizeCategory(cat: string): Category {
  return categoryMap[cat] || "תיק";
}

export async function fetchProducts(): Promise<Product[]> {
  // Fetch ALL products by paginating (Supabase default limit is 1000)
  const allData: Record<string, unknown>[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .range(from, to);

    if (error) {
      console.error("[fetchProducts] Supabase error:", error.message);
      throw new Error(`Supabase fetch failed: ${error.message}`);
    }

    if (data && data.length > 0) {
      allData.push(...data);
      hasMore = data.length === pageSize; // If we got full page, there might be more
      page++;
    } else {
      hasMore = false;
    }
  }

  if (allData.length === 0) {
    throw new Error("Supabase returned no products.");
  }

  console.log(`[fetchProducts] Fetched ${allData.length} products from Supabase`);
  
  const data = allData;

  // Map Supabase data to Product type
  // Using subcategory as category (contains תיק, נעל, ביגוד)
  return data.map((p: Record<string, unknown>, index: number) => ({
    // Use modelRef + color + index as unique ID (original id is "GUESS" for all)
    id: `${p.modelRef ?? "product"}-${p.color ?? ""}-${index}`,
    collection: String(p.collection ?? ""),
    // subcategory contains the category values (תיק, נעל, ביגוד)
    category: normalizeCategory(String(p.subcategory ?? "")),
    subcategory: String(p.subcategory ?? ""),
    brand: String(p.brand ?? ""),
    modelRef: String(p.modelRef ?? ""),
    gender: String(p.gender ?? ""),
    supplier: String(p.supplier ?? ""),
    color: String(p.color ?? ""),
    // Use raw numeric values - NO TRANSFORMATION
    priceRetail: Number(p.priceRetail ?? 0),
    priceWholesale: Number(p.priceWholesale ?? 0),
    stockQuantity: Number(p.stockQuantity ?? 0),
    // Use imageUrl directly from Supabase
    imageUrl: String(p.imageUrl ?? "/images/default.png"),
    gallery: Array.isArray(p.gallery) ? (p.gallery as string[]) : [],
    productName: String(p.productName ?? p.modelRef ?? ""),
    size: String(p.size ?? "")
  }));
}
