import { supabase } from "./supabase";
import { fetchProductsFromGoogleSheet, mapSheetRowToProduct } from "./fetchGoogleSheet";
import type { Product, Category } from "./types";

const categoryMap: Record<string, Category> = {
  "תיק": "תיק",
  "נעל": "נעל",
  "ביגוד": "ביגוד"
};

function normalizeCategory(cat: string): Category {
  // Direct match first
  if (categoryMap[cat as keyof typeof categoryMap]) {
    return categoryMap[cat as keyof typeof categoryMap];
  }
  
  // תיקים (Bags) subcategories
  const bagSubcategories = [
    "ארנקים", "תיק צד", "תיק נשיאה", "מזוודות", "תיק גב", "תיק נסיעות", 
    "תיק ערב", "מחזיק מפתחות"
  ];
  
  // נעליים (Shoes) subcategories
  const shoesSubcategories = [
    "כפכפים", "סניקרס", "נעליים שטוחו", "נעלי עקב", "סנדלים", "מגפיים"
  ];
  
  // Check if it's a bag subcategory
  if (bagSubcategories.some(sub => cat.includes(sub))) {
    return "תיק";
  }
  
  // Check if it's a shoes subcategory
  if (shoesSubcategories.some(sub => cat.includes(sub))) {
    return "נעל";
  }
  
  // Default: ביגוד (Clothes)
  return "ביגוד";
}

/**
 * Recursively list all files in a Storage folder
 */
async function listStorageRecursive(folder: string = "", allFiles: { path: string; name: string }[] = []): Promise<{ path: string; name: string }[]> {
  const { data: items, error } = await supabase.storage
    .from("guess-images")
    .list(folder, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" }
    });

  if (error) {
    console.warn(`[fetchProducts] Error listing ${folder}:`, error.message);
    return allFiles;
  }

  if (!items) return allFiles;

  for (const item of items) {
    const fullPath = folder ? `${folder}/${item.name}` : item.name;
    
    // If it's a folder (no extension or ends with /), recurse
    if (!item.name.includes(".") || item.id === null) {
      await listStorageRecursive(fullPath, allFiles);
    } else {
      // It's a file
      allFiles.push({ path: fullPath, name: item.name });
    }
  }

  return allFiles;
}

/**
 * Parse filename to extract modelRef and color
 * Supports: MODELREF-COLOR-*.jpg, MODELREF_COLOR_*.jpg, or any format with separators
 */
function parseImageFilename(fileName: string): { modelRef: string; color: string } | null {
  const baseName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
  
  // Try dash format first: MODELREF-COLOR-...
  if (baseName.includes("-")) {
    const parts = baseName.split("-");
    if (parts.length >= 2) {
      return {
        modelRef: parts[0].trim().toUpperCase(),
        color: parts[1].trim().toUpperCase(),
      };
    }
  }
  
  // Try underscore format: MODELREF_COLOR_...
  if (baseName.includes("_")) {
    const parts = baseName.split("_");
    if (parts.length >= 2) {
      return {
        modelRef: parts[0].trim().toUpperCase(),
        color: parts[1].trim().toUpperCase(),
      };
    }
  }

  return null;
}

/**
 * Fetch ALL images from Supabase Storage directly (recursively, no products table needed)
 * Images can be in any folder structure
 * Returns a Map with key "modelRef|color" -> { imageUrl, gallery }
 */
async function fetchAllImagesFromSupabaseStorage(): Promise<Map<string, { imageUrl: string; gallery: string[] }>> {
  const imageMap = new Map<string, { imageUrl: string; gallery: string[] }>();
  
  try {
    console.log("[fetchProducts] Listing all images from Supabase Storage (recursive)...");
    
    // List ALL files recursively from root of bucket
    const allFiles = await listStorageRecursive();
    
    if (allFiles.length === 0) {
      console.log("[fetchProducts] No images found in Supabase Storage");
      return imageMap;
    }

    console.log(`[fetchProducts] Found ${allFiles.length} files in Storage`);

    // Group images by product (modelRef + color)
    const productImages = new Map<string, string[]>();

    for (const file of allFiles) {
      const parsed = parseImageFilename(file.name);
      if (!parsed) continue;

      const key = `${parsed.modelRef}|${parsed.color}`;

      if (!productImages.has(key)) {
        productImages.set(key, []);
      }

      // Get public URL for this file
      const { data: urlData } = supabase.storage
        .from("guess-images")
        .getPublicUrl(file.path);

      if (urlData?.publicUrl) {
        productImages.get(key)!.push(urlData.publicUrl);
      }
    }

    // Build final map with first image as imageUrl and all as gallery
    productImages.forEach((urls, key) => {
      // Sort URLs: prioritize files with "PZ" in name
      const sorted = urls.sort((a, b) => {
        const aIsPZ = a.toLowerCase().includes("-pz") || a.toLowerCase().includes("_pz") || a.toLowerCase().includes("pz.");
        const bIsPZ = b.toLowerCase().includes("-pz") || b.toLowerCase().includes("_pz") || b.toLowerCase().includes("pz.");
        if (aIsPZ && !bIsPZ) return -1;
        if (!aIsPZ && bIsPZ) return 1;
        return 0;
      });

      imageMap.set(key, {
        imageUrl: sorted[0] || "/images/default.png",
        gallery: sorted,
      });
    });

    console.log(`[fetchProducts] Mapped ${imageMap.size} products with images from Storage`);
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
