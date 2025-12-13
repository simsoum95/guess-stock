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
 * Fetch images from Supabase Storage for a product
 * Returns default image if product not found in Supabase (which is OK - images are optional)
 */
async function fetchProductImages(modelRef: string, color: string): Promise<{ imageUrl: string; gallery: string[] }> {
  try {
    // Use maybeSingle() instead of single() to handle no results gracefully
    const { data, error } = await supabase
      .from("products")
      .select("imageUrl, gallery")
      .eq("modelRef", modelRef)
      .eq("color", color)
      .maybeSingle(); // Returns null instead of error if no row found

    // If no product found in Supabase or error, return default image
    if (error || !data) {
      return { imageUrl: "/images/default.png", gallery: [] };
    }

    // Return images from Supabase if they exist
    return {
      imageUrl: String(data.imageUrl || "/images/default.png"),
      gallery: Array.isArray(data.gallery) ? (data.gallery as string[]) : [],
    };
  } catch (error) {
    // Silently return default image if any error occurs
    // This is expected if Supabase products table is empty
    return { imageUrl: "/images/default.png", gallery: [] };
  }
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
    console.log("[fetchProducts] Fetching images from Supabase (optional)...");
    
    // TEMPORARY: Skip Supabase image fetching if it causes issues
    // Set SKIP_SUPABASE_IMAGES=true in .env.local to disable
    const skipSupabaseImages = process.env.SKIP_SUPABASE_IMAGES === 'true';
    
    if (skipSupabaseImages) {
      console.log("[fetchProducts] Skipping Supabase images (SKIP_SUPABASE_IMAGES=true)");
      return productsWithData.map((productData) => ({
        ...productData,
        category: normalizeCategory(productData.subcategory || productData.category),
        imageUrl: "/images/default.png",
        gallery: [],
      }));
    }
    
    // Fetch images in batches to avoid too many requests
    const products: Product[] = [];
    const batchSize = 20; // Increased batch size for better performance
    
    for (let i = 0; i < productsWithData.length; i += batchSize) {
      const batch = productsWithData.slice(i, i + batchSize);
      
      // Fetch images in parallel, but handle errors gracefully
      const imagePromises = batch.map((p) => 
        fetchProductImages(p.modelRef, p.color).catch((err) => {
          console.warn(`[fetchProducts] Failed to fetch images for ${p.modelRef} ${p.color}:`, err);
          return {
            imageUrl: "/images/default.png",
            gallery: [],
          };
        })
      );
      
      const images = await Promise.all(imagePromises);

      batch.forEach((productData, idx) => {
        const productImages = images[idx];
        products.push({
          ...productData,
          category: normalizeCategory(productData.subcategory || productData.category),
          imageUrl: productImages.imageUrl || "/images/default.png",
          gallery: productImages.gallery || [],
        });
      });
      
      // Log progress for large datasets
      if ((i + batchSize) % 100 === 0 || i + batchSize >= productsWithData.length) {
        console.log(`[fetchProducts] Processed ${Math.min(i + batchSize, productsWithData.length)}/${productsWithData.length} products...`);
      }
    }

    console.log(`[fetchProducts] Successfully combined ${products.length} products (images from Supabase if available)`);
    
    return products;
  } catch (error) {
    console.error("[fetchProducts] Fatal error:", error);
    // Re-throw with more context
    throw new Error(`Failed to fetch products: ${error instanceof Error ? error.message : String(error)}`);
  }
}
