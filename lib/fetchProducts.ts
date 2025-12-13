import { supabase } from "./supabase";
import type { Product, Category } from "./types";

// Mapping des sous-catégories vers les catégories principales
const subcategoryToCategory: Record<string, Category> = {
  // Catégorie תיק (sacs)
  "תיק": "תיק",
  "תיק צד": "תיק",
  "תיק נשיאה": "תיק",
  "תיק גב": "תיק",
  "תיק נסיעות": "תיק",
  "תיק ערב": "תיק",
  "ארנקים": "תיק",
  "מזוודות": "תיק",
  "מחזיק מפתחות": "תיק",
  
  // Catégorie נעל (chaussures)
  "נעל": "נעל",
  "נעליים שטוחו": "נעל",
  "נעלי עקב": "נעל",
  "סניקרס": "נעל",
  "כפכפים": "נעל",
  "סנדלים": "נעל",
  "מגפיים": "נעל",
  
  // Catégorie ביגוד (vêtements)
  "ביגוד": "ביגוד",
  "טישירט": "ביגוד",
  "סווטשירט": "ביגוד",
  "חולצות": "ביגוד",
  "טופים": "ביגוד",
  "ג'קטים ומעיל": "ביגוד",
  "ג'ינסים": "ביגוד",
  "מכנסיים": "ביגוד",
  "מכנסי טרנינג": "ביגוד",
  "חצאיות": "ביגוד",
  "שמלות ואוברו": "ביגוד",
  "צעיפים": "ביגוד",
  "כובעים": "ביגוד",
  "סט new born": "ביגוד",
  "סט new born": "ביגוד", // Variante avec majuscules
};

function normalizeCategory(cat: string): Category {
  if (!cat) return "תיק";
  
  const normalized = cat.trim();
  
  // Vérifier d'abord le mapping direct
  if (subcategoryToCategory[normalized]) {
    return subcategoryToCategory[normalized];
  }
  
  // Vérifier si ça commence par une catégorie principale
  if (normalized.startsWith("תיק")) return "תיק";
  if (normalized.startsWith("נעל")) return "נעל";
  if (normalized.startsWith("ביגוד")) return "ביגוד";
  
  // Vérifier les mots-clés spécifiques
  const lower = normalized.toLowerCase();
  if (lower.includes("ארנק") || lower.includes("מזווד") || lower.includes("מחזיק מפתחות")) return "תיק";
  if (lower.includes("סניקר") || lower.includes("כפכף") || lower.includes("סנדל") || lower.includes("מגפ")) return "נעל";
  if (lower.includes("טישירט") || lower.includes("סווטשירט") || lower.includes("חולצ") || 
      lower.includes("ג'קט") || lower.includes("ג'ינס") || lower.includes("מכנס") || 
      lower.includes("חצאית") || lower.includes("שמלה") || lower.includes("צעיף") || 
      lower.includes("כובע") || lower.includes("new born")) return "ביגוד";
  
  // Par défaut
  return "תיק";
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

