import { supabase } from "./supabase";
import { fetchProductsFromGoogleSheet, mapSheetRowToProduct } from "./fetchGoogleSheet";
import type { Product, Category } from "./types";

const categoryMap: Record<string, Category> = {
  "תיק": "תיק",
  "נעל": "נעל",
  "ביגוד": "ביגוד"
};

function normalizeCategory(cat: string): Category {
  return categoryMap[cat] || "תיק";
}

/**
 * Fetch ALL images from Supabase in one query (much faster than per-product queries)
 * Returns a Map with key "modelRef|color" -> { imageUrl, gallery }
 */
async function fetchAllImagesFromSupabase(): Promise<Map<string, { imageUrl: string; gallery: string[] }>> {
  const imageMap = new Map<string, { imageUrl: string; gallery: string[] }>();
  
  try {
    // Fetch ALL products with images in one query (paginated if needed)
    let allImages: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("products")
        .select("modelRef, color, imageUrl, gallery")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.warn("[fetchProducts] Error fetching images from Supabase:", error.message);
        break;
      }

      if (data && data.length > 0) {
        allImages.push(...data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    // Build map for fast lookup
    allImages.forEach((p: any) => {
      const key = `${p.modelRef}|${p.color}`.toUpperCase();
      imageMap.set(key, {
        imageUrl: String(p.imageUrl || "/images/default.png"),
        gallery: Array.isArray(p.gallery) ? (p.gallery as string[]) : [],
      });
    });

    console.log(`[fetchProducts] Loaded ${imageMap.size} image mappings from Supabase`);
  } catch (error) {
    console.warn("[fetchProducts] Failed to fetch images from Supabase:", error);
    // Return empty map - all products will use default images
  }

  return imageMap;
}

export async function fetchProducts(): Promise<Product[]> {
  try {
    // Step 1: Fetch products from Google Sheets
    console.log("[fetchProducts] Fetching products from Google Sheets...");
    const sheetRows = await fetchProductsFromGoogleSheet();
    
    if (sheetRows.length === 0) {
      console.warn("[fetchProducts] Google Sheet returned no products");
      return [];
    }

    console.log(`[fetchProducts] Fetched ${sheetRows.length} products from Google Sheets`);

    // Step 2: Map sheet rows to product structure
    const productsWithData = sheetRows.map((row, index) => mapSheetRowToProduct(row, index));

    // Step 3: Fetch images from Supabase and combine with product data
    // Images are optional - if Supabase is empty, products will show default images
    const skipSupabaseImages = process.env.SKIP_SUPABASE_IMAGES === 'true';
    
    let imageMap: Map<string, { imageUrl: string; gallery: string[] }>;
    
    if (skipSupabaseImages) {
      console.log("[fetchProducts] Skipping Supabase images (SKIP_SUPABASE_IMAGES=true)");
      imageMap = new Map(); // Empty map = all products get default images
    } else {
      console.log("[fetchProducts] Fetching all images from Supabase in one query...");
      imageMap = await fetchAllImagesFromSupabase();
    }
    
    // Combine products with images (fast lookup from map)
    const products: Product[] = productsWithData.map((productData) => {
      const key = `${productData.modelRef}|${productData.color}`.toUpperCase();
      const images = imageMap.get(key) || {
        imageUrl: "/images/default.png",
        gallery: [],
      };
      
      return {
        ...productData,
        category: normalizeCategory(productData.subcategory || productData.category),
        imageUrl: images.imageUrl,
        gallery: images.gallery,
      };
    });

    console.log(`[fetchProducts] Successfully combined ${products.length} products`);
    
    return products;
  } catch (error) {
    console.error("[fetchProducts] Fatal error:", error);
    // Re-throw with more context
    throw new Error(`Failed to fetch products: ${error instanceof Error ? error.message : String(error)}`);
  }
}
