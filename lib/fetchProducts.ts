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
    "ארנקים", "ארנק", "תיק צד", "תיק נשיאה", "מזוודות", "תיק גב", "תיק נסיעות", 
    "תיק ערב", "מחזיק מפתחות", "קלאץ"
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
  try {
    const { data: items, error } = await supabase.storage
      .from("guess-images")
      .list(folder, {
        limit: 1000,
        sortBy: { column: "name", order: "asc" }
      });

    if (error) {
      // If folder doesn't exist, that's okay - just skip it
      if (error.message?.includes("not found") || error.message?.includes("404")) {
        return allFiles;
      }
      console.warn(`[fetchProducts] Error listing ${folder || "root"}:`, error.message);
      return allFiles;
    }

    if (!items || items.length === 0) return allFiles;

    for (const item of items) {
      const fullPath = folder ? `${folder}/${item.name}` : item.name;
      
      // Check if it's a file (has extension) or folder (no extension, might have metadata)
      const hasExtension = item.name.includes(".") && !item.name.endsWith("/");
      const isLikelyFile = hasExtension || item.metadata?.size !== undefined;
      
      if (!isLikelyFile) {
        // It's likely a folder, recurse
        await listStorageRecursive(fullPath, allFiles);
      } else {
        // It's a file - only add image files
        const ext = item.name.toLowerCase().split(".").pop();
        if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) {
          allFiles.push({ path: fullPath, name: item.name });
        }
      }
    }
  } catch (error) {
    console.warn(`[fetchProducts] Exception listing ${folder || "root"}:`, error);
  }

  return allFiles;
}

/**
 * Color mapping: abbreviations to full color names
 */
const COLOR_MAP: Record<string, string[]> = {
  "BLA": ["BLACK", "NOIR", "שחור"],
  "BLK": ["BLACK", "NOIR", "שחור"],
  "WHI": ["WHITE", "BLANC", "לבן", "OFFWHITE", "OFF WHITE"],
  "WHT": ["WHITE", "BLANC", "לבן", "OFFWHITE", "OFF WHITE"],
  "OFF": ["OFFWHITE", "OFF WHITE", "OFF-WHITE", "CREAM", "IVORY"],
  "NAD": ["NATURAL", "NATUREL", "טבעי"],
  "NAT": ["NATURAL", "NATUREL", "טבעי"],
  "BRO": ["BROWN", "BRUN", "חום"],
  "TAN": ["TAN", "BEIGE", "בז'"],
  "RED": ["RED", "ROUGE", "אדום"],
  "BLU": ["BLUE", "BLEU", "כחול"],
  "GRE": ["GREEN", "VERT", "ירוק"],
  "PUR": ["PURPLE", "VIOLET", "סגול"],
  "PIN": ["PINK", "ROSE", "ורוד"],
  "YEL": ["YELLOW", "JAUNE", "צהוב"],
  "GRA": ["GRAY", "GREY", "GRIS", "אפור"],
  "GRY": ["GRAY", "GREY", "GRIS", "אפור"],
  "IVO": ["IVORY", "IVOIRE", "שנהב"],
  "NAV": ["NAVY", "NAVY BLUE", "כחול כהה"],
  "ORA": ["ORANGE", "ORANGE", "כתום"],
  "CAM": ["CAMEL", "CHAMEAU", "גמל"],
  "COG": ["COGNAC", "COGNAC BROWN", "קוניאק"],
  "GOL": ["GOLD", "OR", "זהב"],
  "SIL": ["SILVER", "ARGENT", "כסף"],
  "DGR": ["DARK GRAY", "GRIS FONCÉ", "אפור כהה"],
  "LGR": ["LIGHT GRAY", "GRIS CLAIR", "אפור בהיר"],
};

/**
 * Try to match image color abbreviation with product color
 */
function matchesColor(imageColor: string, productColor: string): boolean {
  const imgColorUpper = imageColor.toUpperCase().trim();
  const prodColorUpper = productColor.toUpperCase().trim();
  
  // Exact match
  if (imgColorUpper === prodColorUpper) return true;
  
  // Normalize: remove extra spaces and special chars for comparison
  const imgNormalized = imgColorUpper.replace(/[^A-Z0-9]/g, "");
  const prodNormalized = prodColorUpper.replace(/[^A-Z0-9]/g, "");
  
  if (imgNormalized === prodNormalized) return true;
  
  // Image color starts with product color or vice versa (at least 3 chars)
  if (imgColorUpper.length >= 3 && prodColorUpper.startsWith(imgColorUpper)) return true;
  if (prodColorUpper.length >= 3 && imgColorUpper.startsWith(prodColorUpper)) return true;
  
  // Check if image color is an abbreviation in COLOR_MAP
  const mappedColors = COLOR_MAP[imgColorUpper] || [];
  for (const mapped of mappedColors) {
    if (prodColorUpper.includes(mapped) || mapped.includes(prodColorUpper)) return true;
    // Also check normalized versions
    const mappedNormalized = mapped.replace(/[^A-Z0-9]/g, "");
    if (prodNormalized.includes(mappedNormalized) || mappedNormalized.includes(prodNormalized)) return true;
  }
  
  // Try reverse: product color might be abbreviation
  const reverseMapped = COLOR_MAP[prodColorUpper] || [];
  for (const mapped of reverseMapped) {
    if (imgColorUpper.includes(mapped) || mapped.includes(imgColorUpper)) return true;
    const mappedNormalized = mapped.replace(/[^A-Z0-9]/g, "");
    if (imgNormalized.includes(mappedNormalized) || mappedNormalized.includes(imgNormalized)) return true;
  }
  
  // Partial match: if any word in product color matches
  const prodWords = prodColorUpper.split(/[\s\/\-]+/).filter(w => w.length >= 2);
  const imgWords = imgColorUpper.split(/[\s\/\-]+/).filter(w => w.length >= 2);
  
  for (const imgWord of imgWords) {
    for (const prodWord of prodWords) {
      // Match if one starts with the other (at least 3 chars) or exact match
      if (imgWord.length >= 3 && prodWord.startsWith(imgWord)) return true;
      if (prodWord.length >= 3 && imgWord.startsWith(prodWord)) return true;
      if (imgWord === prodWord) return true;
    }
  }
  
  // Last resort: check if first 3-4 chars match
  if (imgNormalized.length >= 3 && prodNormalized.length >= 3) {
    if (imgNormalized.substring(0, 4) === prodNormalized.substring(0, 4)) return true;
    if (imgNormalized.substring(0, 3) === prodNormalized.substring(0, 3)) return true;
  }
  
  return false;
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

      // Get public URL for this file (also store the filename for sorting)
      const { data: urlData } = supabase.storage
        .from("guess-images")
        .getPublicUrl(file.path);

      if (urlData?.publicUrl) {
        productImages.get(key)!.push(urlData.publicUrl);
      }
    }

    // Build final map with first image as imageUrl and all as gallery
    productImages.forEach((urls, key) => {
      // Sort URLs with priority rules:
      // 1. Images ending with "PZ" (case insensitive)
      // 2. Images ending with "F" (if no PZ found)
      // 3. Other images
      const sorted = urls.sort((a, b) => {
        // Extract filename from URL (get last part after /)
        const getFileName = (url: string) => {
          const parts = url.split('/');
          return parts[parts.length - 1].toLowerCase();
        };
        
        const aFile = getFileName(a);
        const bFile = getFileName(b);
        
        // Check if filename ends with "PZ" (before extension)
        const aEndsPZ = /pz\.(jpg|jpeg|png|webp|gif)$/i.test(aFile);
        const bEndsPZ = /pz\.(jpg|jpeg|png|webp|gif)$/i.test(bFile);
        
        // Check if filename ends with "F" (before extension)
        const aEndsF = /f\.(jpg|jpeg|png|webp|gif)$/i.test(aFile);
        const bEndsF = /f\.(jpg|jpeg|png|webp|gif)$/i.test(bFile);
        
        // Priority 1: PZ images first
        if (aEndsPZ && !bEndsPZ) return -1;
        if (!aEndsPZ && bEndsPZ) return 1;
        
        // Priority 2: If no PZ, F images come first
        // Only prioritize F if there's no PZ in the list
        const hasAnyPZ = urls.some(url => /pz\.(jpg|jpeg|png|webp|gif)$/i.test(getFileName(url)));
        if (!hasAnyPZ) {
          if (aEndsF && !bEndsF) return -1;
          if (!aEndsF && bEndsF) return 1;
        }
        
        return 0; // Keep original order for others
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
    // Check environment variable first
    if (!process.env.GOOGLE_SHEET_ID) {
      const errorMsg = "GOOGLE_SHEET_ID environment variable is not set. Please configure it in Vercel Settings → Environment Variables.";
      console.error("[fetchProducts] FATAL:", errorMsg);
      throw new Error(errorMsg);
    }

    // Step 1: Fetch products from Google Sheets
    console.log("[fetchProducts] ===== STARTING PRODUCT FETCH =====");
    console.log("[fetchProducts] GOOGLE_SHEET_ID:", process.env.GOOGLE_SHEET_ID ? `${process.env.GOOGLE_SHEET_ID.substring(0, 10)}...` : "NOT SET");
    console.log("[fetchProducts] GOOGLE_API_KEY:", process.env.GOOGLE_API_KEY ? "SET" : "NOT SET");
    console.log("[fetchProducts] GOOGLE_SHEET_NAME:", process.env.GOOGLE_SHEET_NAME || "Sheet1");
    
    let sheetRows: any[] = [];
    try {
      sheetRows = await fetchProductsFromGoogleSheet();
      console.log(`[fetchProducts] ✅ fetchProductsFromGoogleSheet returned ${sheetRows.length} rows`);
    } catch (error) {
      console.error("[fetchProducts] ❌ ERROR in fetchProductsFromGoogleSheet:", error);
      throw error;
    }
    
    if (sheetRows.length === 0) {
      console.error("[fetchProducts] ❌ CRITICAL: Google Sheet returned 0 products!");
      console.error("[fetchProducts] Possible causes:");
      console.error("  1. Sheet is empty or has no data rows");
      console.error("  2. Sheet is not public (needs 'Anyone with the link' → 'Viewer' permission)");
      console.error("  3. Sheet name doesn't match (check GOOGLE_SHEET_NAME env var)");
      console.error("  4. API key has wrong permissions");
      console.error("  5. All rows were filtered out (check logs for 'After filtering')");
      return [];
    }

    console.log(`[fetchProducts] ✅ Fetched ${sheetRows.length} products from Google Sheets`);

    // Step 2: Map sheet rows to product structure
    console.log("[fetchProducts] Mapping sheet rows to products...");
    const productsWithData = sheetRows.map((row, index) => {
      try {
        return mapSheetRowToProduct(row, index);
      } catch (error) {
        console.error(`[fetchProducts] Error mapping row ${index}:`, error);
        // Return a minimal product to avoid breaking everything
        return {
          id: `error-${index}`,
          collection: "",
          category: "ביגוד" as Category,
          subcategory: "",
          brand: "",
          modelRef: row["קוד גם"] || row["modelRef"] || "",
          gender: "",
          supplier: "",
          color: "",
          priceRetail: 0,
          priceWholesale: 0,
          stockQuantity: 0,
        };
      }
    });
    console.log(`[fetchProducts] ✅ Mapped ${productsWithData.length} products`);

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
    
    // Build index for faster lookup: modelRef -> array of {color, images}
    const modelRefIndex = new Map<string, Array<{ color: string; images: { imageUrl: string; gallery: string[] } }>>();
    for (const [imgKey, imgData] of imageMap.entries()) {
      const [imgModelRef, imgColor] = imgKey.split("|");
      if (!modelRefIndex.has(imgModelRef)) {
        modelRefIndex.set(imgModelRef, []);
      }
      modelRefIndex.get(imgModelRef)!.push({ color: imgColor, images: imgData });
    }
    
    console.log(`[fetchProducts] Built index: ${modelRefIndex.size} unique modelRefs with images`);
    
    // Combine products with images (intelligent matching)
    let matchedCount = 0;
    let exactMatches = 0;
    let colorMatches = 0;
    let modelOnlyMatches = 0;
    let noMatches = 0;
    
    // Track category distribution for debugging
    const categoryStats = {
      "תיק": 0,
      "נעל": 0,
      "ביגוד": 0,
    };
    const subcategoryMap = new Map<string, number>();
    
    const products: Product[] = productsWithData.map((productData) => {
      const productModelRef = productData.modelRef.toUpperCase().trim();
      const productColor = productData.color.toUpperCase().trim();
      
      // Try exact match first
      let key = `${productModelRef}|${productColor}`;
      let images = imageMap.get(key);
      
      if (images) {
        exactMatches++;
        matchedCount++;
      } else {
        // Look up by modelRef in index
        const modelRefImages = modelRefIndex.get(productModelRef);
        
        if (modelRefImages && modelRefImages.length > 0) {
          // Try to match by color intelligently
          let foundMatch = false;
          for (const item of modelRefImages) {
            if (matchesColor(item.color, productColor)) {
              images = item.images;
              colorMatches++;
              matchedCount++;
              foundMatch = true;
              break;
            }
          }
          
          // If no color match, use first image for this modelRef
          if (!foundMatch && modelRefImages.length > 0) {
            images = modelRefImages[0].images;
            modelOnlyMatches++;
            matchedCount++;
          }
        }
      }
      
      if (!images) {
        noMatches++;
      }
      
      const finalCategory = normalizeCategory(productData.subcategory || productData.category);
      
      // Track category statistics
      categoryStats[finalCategory] = (categoryStats[finalCategory] || 0) + 1;
      const subcat = productData.subcategory || productData.category || "unknown";
      subcategoryMap.set(subcat, (subcategoryMap.get(subcat) || 0) + 1);
      
      return {
        ...productData,
        category: finalCategory,
        imageUrl: images?.imageUrl || "/images/default.png",
        gallery: images?.gallery || [],
      };
    });
    
    console.log(`[fetchProducts] Category distribution:`);
    console.log(`  - תיק (Bags): ${categoryStats["תיק"]} products`);
    console.log(`  - נעל (Shoes): ${categoryStats["נעל"]} products`);
    console.log(`  - ביגוד (Clothes): ${categoryStats["ביגוד"]} products`);
    console.log(`[fetchProducts] Total products by subcategory (top 10):`);
    const sortedSubcats = Array.from(subcategoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    sortedSubcats.forEach(([subcat, count]) => {
      console.log(`  - "${subcat}": ${count} products`);
    });
    
    console.log(`[fetchProducts] Image matching stats:`);
    console.log(`  - Exact matches: ${exactMatches}`);
    console.log(`  - Color-matched: ${colorMatches}`);
    console.log(`  - ModelRef-only: ${modelOnlyMatches}`);
    console.log(`  - No matches: ${noMatches}`);
    console.log(`  - Total matched: ${matchedCount}/${products.length} products (${((matchedCount/products.length)*100).toFixed(1)}%)`);

    console.log(`[fetchProducts] Successfully combined ${products.length} products`);
    
    return products;
  } catch (error) {
    console.error("[fetchProducts] Fatal error:", error);
    // Re-throw with more context
    throw new Error(`Failed to fetch products: ${error instanceof Error ? error.message : String(error)}`);
  }
}
