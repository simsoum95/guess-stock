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
 */
async function fetchProductImages(modelRef: string, color: string): Promise<{ imageUrl: string; gallery: string[] }> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("imageUrl, gallery")
      .eq("modelRef", modelRef)
      .eq("color", color)
      .single();

    if (error || !data) {
      return { imageUrl: "/images/default.png", gallery: [] };
    }

    return {
      imageUrl: String(data.imageUrl || "/images/default.png"),
      gallery: Array.isArray(data.gallery) ? (data.gallery as string[]) : [],
    };
  } catch (error) {
    console.error(`[fetchProducts] Error fetching images for ${modelRef} ${color}:`, error);
    return { imageUrl: "/images/default.png", gallery: [] };
  }
}

export async function fetchProducts(): Promise<Product[]> {
  // Step 1: Fetch products from Google Sheets
  console.log("[fetchProducts] Fetching products from Google Sheets...");
  const sheetRows = await fetchProductsFromGoogleSheet();
  
  if (sheetRows.length === 0) {
    throw new Error("Google Sheet returned no products.");
  }

  console.log(`[fetchProducts] Fetched ${sheetRows.length} products from Google Sheets`);

  // Step 2: Map sheet rows to product structure
  const productsWithData = sheetRows.map((row, index) => mapSheetRowToProduct(row, index));

  // Step 3: Fetch images from Supabase and combine with product data
  console.log("[fetchProducts] Fetching images from Supabase...");
  
  // Fetch images in batches to avoid too many requests
  const products: Product[] = [];
  const batchSize = 10;
  
  for (let i = 0; i < productsWithData.length; i += batchSize) {
    const batch = productsWithData.slice(i, i + batchSize);
    const imagePromises = batch.map((p) => fetchProductImages(p.modelRef, p.color));
    const images = await Promise.all(imagePromises);

    batch.forEach((productData, idx) => {
      const productImages = images[idx];
      products.push({
        ...productData,
        category: normalizeCategory(productData.subcategory || productData.category),
        imageUrl: productImages.imageUrl,
        gallery: productImages.gallery,
      });
    });
  }

  console.log(`[fetchProducts] Combined ${products.length} products with images from Supabase`);
  
  return products;
}
