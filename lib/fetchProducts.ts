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
 * Fetch ALL images from Supabase Storage directly (no products table needed)
 * Images are stored as: products/{modelRef}-{color}-*.jpg
 * Returns a Map with key "modelRef|color" -> { imageUrl, gallery }
 */
async function fetchAllImagesFromSupabaseStorage(): Promise<Map<string, { imageUrl: string; gallery: string[] }>> {
  const imageMap = new Map<string, { imageUrl: string; gallery: string[] }>();
  
  try {
    // List all files in the products folder in Supabase Storage
    const { data: files, error } = await supabase.storage
      .from("guess-images")
      .list("products", {
        limit: 10000, // Get up to 10000 images
        sortBy: { column: "name", order: "asc" }
      });

    if (error) {
      // If bucket doesn't exist or no files, return empty map
      console.warn("[fetchProducts] Error listing images from Supabase Storage:", error.message);
      return imageMap;
    }

    if (!files || files.length === 0) {
      console.log("[fetchProducts] No images found in Supabase Storage");
      return imageMap;
    }

    // Group images by product (modelRef + color)
    // Format: MODELREF-COLOR-*.jpg or MODELREF_COLOR_*.jpg
    const productImages = new Map<string, string[]>();

    for (const file of files) {
      if (!file.name || file.name.includes(".") === false) continue;

      // Extract modelRef and color from filename
      // Try both - and _ as separators
      const baseName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
      const parts = baseName.split(/[-_]/);
      
      if (parts.length < 2) continue;

      const modelRef = parts[0].toUpperCase();
      const color = parts[1].toUpperCase();
      const key = `${modelRef}|${color}`;

      if (!productImages.has(key)) {
        productImages.set(key, []);
      }

      // Get public URL for this file
      const { data: urlData } = supabase.storage
        .from("guess-images")
        .getPublicUrl(`products/${file.name}`);

      if (urlData?.publicUrl) {
        productImages.get(key)!.push(urlData.publicUrl);
      }
    }

    // Build final map with first image as imageUrl and all as gallery
    productImages.forEach((urls, key) => {
      // Sort URLs: prioritize files ending with "PZ"
      const sorted = urls.sort((a, b) => {
        const aIsPZ = a.toLowerCase().includes("-pz") || a.toLowerCase().includes("_pz");
        const bIsPZ = b.toLowerCase().includes("-pz") || b.toLowerCase().includes("_pz");
        if (aIsPZ && !bIsPZ) return -1;
        if (!aIsPZ && bIsPZ) return 1;
        return 0;
      });

      imageMap.set(key, {
        imageUrl: sorted[0] || "/images/default.png",
        gallery: sorted,
      });
    });

    console.log(`[fetchProducts] Loaded ${imageMap.size} product image mappings from Supabase Storage`);
  } catch (error) {
    console.warn("[fetchProducts] Failed to fetch images from Supabase Storage:", error);
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

    // Step 3: Fetch images from Supabase Storage (no products table needed)
    // Images are stored directly in Storage: products/{modelRef}-{color}-*.jpg
    const skipSupabaseImages = process.env.SKIP_SUPABASE_IMAGES === 'true';
    
    let imageMap: Map<string, { imageUrl: string; gallery: string[] }>;
    
    if (skipSupabaseImages) {
      console.log("[fetchProducts] Skipping Supabase images (SKIP_SUPABASE_IMAGES=true)");
      imageMap = new Map(); // Empty map = all products get default images
    } else {
      console.log("[fetchProducts] Fetching images from Supabase Storage...");
      imageMap = await fetchAllImagesFromSupabaseStorage();
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
