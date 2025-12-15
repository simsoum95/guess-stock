import { supabase } from "./supabase";
import { fetchProductsFromGoogleSheet, mapSheetRowToProduct } from "./fetchGoogleSheet";
import type { Product, Category } from "./types";

// In-memory cache for images (survives between requests on same server instance)
let imageCache: Map<string, { imageUrl: string; gallery: string[] }> | null = null;
let imageCacheTime: number = 0;
const IMAGE_CACHE_TTL = 30 * 1000; // 30 seconds (reduced for faster updates)

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
    "תיק ערב", "מחזיק מפתחות", "קלאץ", "תיק יד", "תיק כתף", "תיק עסקים"
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
 * Search images for a specific modelRef using Storage API search
 * This is MUCH faster than listing all files
 */
async function searchImagesForModelRef(modelRef: string): Promise<{ path: string; name: string }[]> {
  const files: { path: string; name: string }[] = [];
  
  try {
    // Search in "products" folder for files matching modelRef
    const { data: items, error } = await supabase.storage
      .from("guess-images")
      .list("products", {
        limit: 100,
        search: modelRef // This filters by filename containing modelRef
      });

    if (error) {
      console.warn(`[fetchProducts] Error searching for ${modelRef}:`, error.message);
      return files;
    }

    if (items) {
      for (const item of items) {
        if (item.name.includes(".")) {
          files.push({ path: `products/${item.name}`, name: item.name });
        }
      }
    }
  } catch (error) {
    console.warn(`[fetchProducts] Exception searching for ${modelRef}:`, error);
  }

  return files;
}

/**
 * Alternative: List files with pagination (slower, used as fallback)
 */
async function listStorageRecursive(folder: string = "", allFiles: { path: string; name: string }[] = []): Promise<{ path: string; name: string }[]> {
  const BATCH_SIZE = 1000;
  let offset = 0;
  let hasMore = true;
  const MAX_BATCHES = 20; // Limit to prevent timeout
  let batchCount = 0;

  try {
    while (hasMore && batchCount < MAX_BATCHES) {
      const { data: items, error } = await supabase.storage
        .from("guess-images")
        .list(folder, {
          limit: BATCH_SIZE,
          offset: offset,
          sortBy: { column: "name", order: "asc" }
        });

      batchCount++;

      if (error) {
        if (error.message?.includes("not found") || error.message?.includes("404")) {
          return allFiles;
        }
        console.warn(`[fetchProducts] Error listing ${folder || "root"} at offset ${offset}:`, error.message);
        break;
      }

      if (!items || items.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of items) {
        const fullPath = folder ? `${folder}/${item.name}` : item.name;
        
        const hasExtension = item.name.includes(".") && !item.name.endsWith("/");
        const isLikelyFile = hasExtension || item.metadata?.size !== undefined;
        
        if (!isLikelyFile) {
          await listStorageRecursive(fullPath, allFiles);
        } else {
          const ext = item.name.toLowerCase().split(".").pop();
          if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) {
            allFiles.push({ path: fullPath, name: item.name });
          }
        }
      }

      if (items.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        offset += BATCH_SIZE;
      }
    }
  } catch (error) {
    console.warn(`[fetchProducts] Exception listing ${folder || "root"}:`, error);
  }

  return allFiles;
}

/**
 * Color mapping: abbreviations to full color names
 * Extended with all observed patterns from image filenames
 */
const COLOR_MAP: Record<string, string[]> = {
  // Black variants
  "BLA": ["BLACK", "NOIR", "שחור", "BLK", "BLO"],
  "BLK": ["BLACK", "NOIR", "שחור", "BLA", "BLO"],
  "BLO": ["BLACK", "NOIR", "שחור", "BLA", "BLK", "BLACKLOGO"],
  "BLACK": ["BLA", "BLK", "BLO"],
  "BLACKLOGO": ["BLA", "BLK", "BLO", "BLACK"],
  
  // White variants
  "WHI": ["WHITE", "BLANC", "לבן"],
  "WHT": ["WHITE", "BLANC", "לבן"],
  "WHITE": ["WHI", "WHT"],
  
  // Off-white / Cream variants
  "OFF": ["OFFWHITE", "OFF WHITE", "OFF-WHITE", "CREAM", "IVORY", "NATURALOFFWHITE"],
  "OFFWHITE": ["OFF", "CREAM", "IVORY"],
  "CREAM": ["OFF", "OFFWHITE", "CRE"],
  
  // Natural variants (common in bags)
  "NAD": ["NATURAL", "NATUREL", "טבעי", "NAT"],
  "NAT": ["NATURAL", "NATUREL", "טבעי", "NAD"],
  "NATURAL": ["NAD", "NAT"],
  "NATURALBLACK": ["NAD", "NAT", "NATBLACK"],
  "NATURALCOGNAC": ["NAD", "NAT", "NATCOGNAC", "COG"],
  "NATURALOFFWHITE": ["NAD", "NAT", "OFF", "OFFWHITE"],
  
  // Brown variants
  "BRO": ["BROWN", "BRUN", "חום"],
  "BROWN": ["BRO"],
  "TAN": ["TAN", "BEIGE", "בז'"],
  "BEI": ["BEIGE", "TAN"],
  "BEIGE": ["BEI", "TAN"],
  
  // Cognac (leather color)
  "COG": ["COGNAC", "COGNAC BROWN", "קוניאק"],
  "COGNAC": ["COG"],
  
  // Blue variants
  "BLU": ["BLUE", "BLEU", "כחול"],
  "BLUE": ["BLU"],
  "NAV": ["NAVY", "NAVY BLUE", "כחול כהה"],
  "NAVY": ["NAV"],
  
  // Green variants
  "GRE": ["GREEN", "VERT", "ירוק"],
  "GREEN": ["GRE"],
  
  // Red/Pink variants
  "RED": ["RED", "ROUGE", "אדום"],
  "PIN": ["PINK", "ROSE", "ורוד"],
  "PINK": ["PIN"],
  "ROS": ["ROSE", "PINK"],
  
  // Yellow/Gold variants
  "YEL": ["YELLOW", "JAUNE", "צהוב"],
  "YELLOW": ["YEL"],
  "GOL": ["GOLD", "OR", "זהב"],
  "GOLD": ["GOL"],
  
  // Gray/Silver variants
  "GRA": ["GRAY", "GREY", "GRIS", "אפור"],
  "GRY": ["GRAY", "GREY", "GRIS", "אפור"],
  "GRAY": ["GRA", "GRY"],
  "GREY": ["GRA", "GRY"],
  "SIL": ["SILVER", "ARGENT", "כסף"],
  "SILVER": ["SIL"],
  "DGR": ["DARK GRAY", "GRIS FONCÉ", "אפור כהה"],
  "LGR": ["LIGHT GRAY", "GRIS CLAIR", "אפור בהיר"],
  
  // Purple variants
  "PUR": ["PURPLE", "VIOLET", "סגול"],
  "PURPLE": ["PUR"],
  
  // Orange variants
  "ORA": ["ORANGE", "כתום"],
  "ORANGE": ["ORA"],
  
  // Other common colors
  "IVO": ["IVORY", "IVOIRE", "שנהב", "OFF"],
  "IVORY": ["IVO", "OFF"],
  "CAM": ["CAMEL", "CHAMEAU", "גמל"],
  "CAMEL": ["CAM"],
  "LIS": ["LIGHT", "LISO"],
  "NRC": ["NATURAL ROSE COGNAC", "ROSECOGNAC"],
  "NTB": ["NATURAL TAN BROWN", "TANBROWN"],
  "LUG": ["LUGGAGE", "LUGGAGE BROWN", "LIGHT TAUPE", "LIGHTTAUPE", "LIGHTTAUPELOGO", "TAUPE"],
  "LIGHTTAUPE": ["LUG", "LUGGAGE", "TAUPE"],
  "LIGHTTAUPELOGO": ["LUG", "LUGGAGE", "TAUPE", "LIGHTTAUPE"],
  "TAUPE": ["LUG", "LIGHTTAUPE"],
  "LOGO": ["LOGO", "WITH LOGO"],
};

/**
 * Try to match image color abbreviation with product color
 * Enhanced to handle suffixes like -OS, partial matches, and abbreviations
 */
function matchesColor(imageColor: string, productColor: string): boolean {
  const imgColorUpper = imageColor.toUpperCase().trim();
  const prodColorUpper = productColor.toUpperCase().trim();
  
  // Exact match
  if (imgColorUpper === prodColorUpper) return true;
  
  // Normalize: remove extra spaces, special chars, and common suffixes for comparison
  const cleanColor = (c: string) => c
    .replace(/[^A-Z0-9]/g, "")
    .replace(/OS$/, "")      // Remove -OS suffix
    .replace(/LOGO$/, "");   // Remove LOGO suffix
  
  const imgNormalized = cleanColor(imgColorUpper);
  const prodNormalized = cleanColor(prodColorUpper);
  
  if (imgNormalized === prodNormalized) return true;
  
  // Check if one contains the other
  if (imgNormalized.includes(prodNormalized) && prodNormalized.length >= 3) return true;
  if (prodNormalized.includes(imgNormalized) && imgNormalized.length >= 3) return true;
  
  // Image color starts with product color or vice versa (at least 3 chars)
  if (imgNormalized.length >= 3 && prodNormalized.startsWith(imgNormalized)) return true;
  if (prodNormalized.length >= 3 && imgNormalized.startsWith(prodNormalized)) return true;
  
  // Check COLOR_MAP with both normalized versions
  const tryColorMap = (abbrev: string, fullColor: string) => {
    const mapped = COLOR_MAP[abbrev] || [];
    const fullNorm = cleanColor(fullColor);
    for (const m of mapped) {
      const mNorm = cleanColor(m);
      if (fullNorm.includes(mNorm) || mNorm.includes(fullNorm)) return true;
      if (fullNorm.startsWith(mNorm) || mNorm.startsWith(fullNorm)) return true;
    }
    return false;
  };
  
  // Try both directions with COLOR_MAP
  if (tryColorMap(imgNormalized, prodNormalized)) return true;
  if (tryColorMap(prodNormalized, imgNormalized)) return true;
  
  // Try with first 3 chars as abbreviation
  if (imgNormalized.length >= 3) {
    if (tryColorMap(imgNormalized.substring(0, 3), prodNormalized)) return true;
  }
  if (prodNormalized.length >= 3) {
    if (tryColorMap(prodNormalized.substring(0, 3), imgNormalized)) return true;
  }
  
  // Split by words and check each
  const prodWords = prodColorUpper.split(/[\s\/\-]+/).filter(w => w.length >= 2);
  const imgWords = imgColorUpper.split(/[\s\/\-]+/).filter(w => w.length >= 2);
  
  for (const imgWord of imgWords) {
    const imgWordClean = cleanColor(imgWord);
    for (const prodWord of prodWords) {
      const prodWordClean = cleanColor(prodWord);
      // Skip common suffixes that aren't colors
      if (["OS", "LOGO", ""].includes(prodWordClean)) continue;
      
      // Match if one starts with the other or contains
      if (imgWordClean.length >= 3 && prodWordClean.startsWith(imgWordClean)) return true;
      if (prodWordClean.length >= 3 && imgWordClean.startsWith(prodWordClean)) return true;
      if (imgWordClean.includes(prodWordClean) && prodWordClean.length >= 3) return true;
      if (prodWordClean.includes(imgWordClean) && imgWordClean.length >= 3) return true;
      if (imgWordClean === prodWordClean) return true;
      
      // Try COLOR_MAP on individual words
      if (tryColorMap(imgWordClean, prodWordClean)) return true;
      if (tryColorMap(prodWordClean, imgWordClean)) return true;
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
 * Fetch ALL images using fast SQL RPC function
 * Returns a Map with key "modelRef|color" -> { imageUrl, gallery }
 */
async function fetchAllImagesFromSupabaseStorage(): Promise<Map<string, { imageUrl: string; gallery: string[] }>> {
  // Check cache first
  const now = Date.now();
  if (imageCache && (now - imageCacheTime) < IMAGE_CACHE_TTL) {
    console.log(`[fetchProducts] Using cached images (${imageCache.size} products, age: ${Math.round((now - imageCacheTime) / 1000)}s)`);
    return imageCache;
  }
  
  const imageMap = new Map<string, { imageUrl: string; gallery: string[] }>();
  
  try {
    console.log("[fetchProducts] Fetching images from image_index table...");
    
    // Try to use image_index table first (FAST!)
    const { data: indexData, error: indexError } = await supabase
      .from('image_index')
      .select('model_ref, color, url, filename')
      .limit(50000);
    
    let allFiles: { path: string; name: string; url?: string; modelRef?: string; color?: string }[] = [];
    
    if (indexError || !indexData || indexData.length === 0) {
      console.warn("[fetchProducts] image_index table empty or error, falling back to Storage API...");
      console.warn("[fetchProducts] Error:", indexError?.message);
      
      // Fallback: paginated Storage API (slower)
      const BATCH_SIZE = 1000;
      let offset = 0;
      let hasMore = true;
      let batchCount = 0;
      const MAX_BATCHES = 20;
      
      while (hasMore && batchCount < MAX_BATCHES) {
        const { data: items, error } = await supabase.storage
          .from("guess-images")
          .list("products", {
            limit: BATCH_SIZE,
            offset: offset,
            sortBy: { column: "name", order: "asc" }
          });
        
        batchCount++;
        
        if (error || !items || items.length === 0) {
          hasMore = false;
          break;
        }
        
        for (const item of items) {
          if (item.name.includes(".")) {
            allFiles.push({ path: `products/${item.name}`, name: item.name });
          }
        }
        
        if (items.length < BATCH_SIZE) {
          hasMore = false;
        } else {
          offset += BATCH_SIZE;
        }
      }
      
      console.log(`[fetchProducts] Loaded ${allFiles.length} images from Storage (fallback)`);
    } else {
      // Use pre-indexed data (FAST!)
      console.log(`[fetchProducts] ✅ Loaded ${indexData.length} images from index table (instant!)`);
      
      allFiles = indexData.map((row: any) => ({
        path: `products/${row.filename}`,
        name: row.filename,
        url: row.url,
        modelRef: row.model_ref,
        color: row.color
      }));
    }
    
    if (allFiles.length === 0) {
      console.log("[fetchProducts] No images found");
      return imageMap;
    }

    console.log(`[fetchProducts] Processing ${allFiles.length} files...`);

    // Group images by product (modelRef + color)
    const productImages = new Map<string, string[]>();

    for (const file of allFiles) {
      // Use pre-parsed data if available (from index table)
      let modelRef = file.modelRef;
      let color = file.color;
      let url = file.url;
      
      // Fallback to parsing if not from index
      if (!modelRef || !color) {
        const parsed = parseImageFilename(file.name);
        if (!parsed) continue;
        modelRef = parsed.modelRef;
        color = parsed.color;
      }
      
      // Get URL if not from index
      if (!url) {
        const { data: urlData } = supabase.storage
          .from("guess-images")
          .getPublicUrl(file.path);
        url = urlData?.publicUrl;
      }

      if (!url) continue;

      const key = `${modelRef}|${color}`;

      if (!productImages.has(key)) {
        productImages.set(key, []);
      }

      productImages.get(key)!.push(url);
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
    
    // Update cache
    imageCache = imageMap;
    imageCacheTime = Date.now();
    console.log(`[fetchProducts] Images cached for ${IMAGE_CACHE_TTL / 1000}s`);
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
      // Use colorCode from itemCode (e.g., "BLO" from "PD760221-BLO-OS") - more reliable for matching
      const productColorCode = (productData as any).colorCode?.toUpperCase().trim() || "";
      
      // Try exact match with colorCode first (most reliable)
      let images: { imageUrl: string; gallery: string[] } | undefined;
      
      if (productColorCode) {
        const keyWithCode = `${productModelRef}|${productColorCode}`;
        images = imageMap.get(keyWithCode);
        if (images) {
          exactMatches++;
          matchedCount++;
        }
      }
      
      // Try exact match with full color name
      if (!images) {
        const key = `${productModelRef}|${productColor}`;
        images = imageMap.get(key);
        if (images) {
          exactMatches++;
          matchedCount++;
        }
      }
      
      // Look up by modelRef in index and try color matching
      if (!images) {
        const modelRefImages = modelRefIndex.get(productModelRef);
        
        if (modelRefImages && modelRefImages.length > 0) {
          // First try with colorCode (e.g., "BLO")
          if (productColorCode) {
            for (const item of modelRefImages) {
              if (item.color === productColorCode || matchesColor(item.color, productColorCode)) {
                images = item.images;
                colorMatches++;
                matchedCount++;
                break;
              }
            }
          }
          
          // Then try with full color name
          if (!images) {
            for (const item of modelRefImages) {
              if (matchesColor(item.color, productColor)) {
                images = item.images;
                colorMatches++;
                matchedCount++;
                break;
              }
            }
          }
          
          // If no color match, do NOT use a wrong image
          if (!images) {
            modelOnlyMatches++;
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
