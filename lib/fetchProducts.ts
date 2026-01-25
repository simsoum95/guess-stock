import { supabase } from "./supabase";
import { fetchProductsFromGoogleSheet, mapSheetRowToProduct } from "./fetchGoogleSheet";
import type { Product, Category } from "./types";

// In-memory cache for images (survives between requests on same server instance)
let imageCache: Map<string, { imageUrl: string; gallery: string[] }> | null = null;
let imageCacheTime: number = 0;
const IMAGE_CACHE_TTL = 1 * 60 * 1000; // 1 minute - faster performance but fresh images

const categoryMap: Record<string, Category> = {
  "תיק": "תיק",
  "נעל": "נעל",
};

function normalizeCategory(cat: string): Category {
  // Direct match first
  if (categoryMap[cat as keyof typeof categoryMap]) {
    return categoryMap[cat as keyof typeof categoryMap];
  }
  
  // תיקים (Bags) subcategories
  const bagSubcategories = [
    "ארנקים", "ארנק", "תיק צד", "תיק נשיאה", "מזוודות", "תיק גב", "תיק נסיעות", 
    "תיק ערב", "מחזיק מפתחות", "תיק יד", "תיק כתף", "תיק עסקים"
  ];
  
  // נעליים (Shoes) subcategories
  const shoesSubcategories = [
    "כפכפים", "סניקרס", "נעליים שטוחו", "נעלי עקב", "מגפיים",
    "סנדלים", "נעליים", "נעל"  // Added sandals and shoes variations
  ];
  
  // Check if it's a bag subcategory
  if (bagSubcategories.some(sub => cat.includes(sub))) {
    return "תיק";
  }
  
  // Check if it's a shoes subcategory
  if (shoesSubcategories.some(sub => cat.includes(sub))) {
    return "נעל";
  }
  
  // Default: תיק (Bags)
  return "תיק";
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
 * Including GUESS shoes color codes (DNA01, LNA01, MBR02, etc.)
 */
const COLOR_MAP: Record<string, string[]> = {
  // Black variants - including short codes with numbers
  "BLA": ["BLACK", "NOIR", "שחור", "BLK", "BLO"],
  "BLK": ["BLACK", "NOIR", "שחור", "BLA", "BLO"],
  "BLO": ["BLACK", "NOIR", "שחור", "BLA", "BLK", "BLACKLOGO"],
  "BLACK": ["BLA", "BLK", "BLO"],
  "BLACKLOGO": ["BLA", "BLK", "BLO", "BLACK"],
  
  // Dark Brown variants
  "DBR": ["DARK BROWN", "DARKBROWN", "BROWN", "DARK", "BRO"],
  "DARKBROWN": ["DBR", "DARK BROWN", "BRO"],
  "DARK BROWN": ["DBR", "DARKBROWN", "BRO"],
  
  // Medium Brown variants (GUESS shoes)
  "MBR": ["MEDIUM BROWN", "MEDIUMBROWN", "BROWN", "BRO"],
  "MEDIUMBROWN": ["MBR", "MEDIUM BROWN", "BRO"],
  "MEDIUM BROWN": ["MBR", "MEDIUMBROWN", "BRO"],
  
  // Light Brown variants
  "LBR": ["LIGHT BROWN", "LIGHTBROWN", "BROWN", "BRO", "TAN"],
  "LIGHTBROWN": ["LBR", "LIGHT BROWN", "BRO", "TAN"],
  "LIGHT BROWN": ["LBR", "LIGHTBROWN", "BRO", "TAN"],
  
  // Dress / Other color codes
  "DRE": ["DRESS", "DRESSY", "DRS"],
  "DRS": ["DRESS", "DRE"],
  
  // White variants
  "WHI": ["WHITE", "BLANC", "לבן", "WHT", "IVO", "IVORY"],
  "WHT": ["WHITE", "BLANC", "לבן", "WHI"],
  "WHITE": ["WHI", "WHT", "IVO"],
  
  // Off-white / Cream variants
  "OFF": ["OFFWHITE", "OFF WHITE", "OFF-WHITE", "CREAM", "IVORY", "NATURALOFFWHITE"],
  "OFFWHITE": ["OFF", "CREAM", "IVORY"],
  "CREAM": ["OFF", "OFFWHITE", "CRE"],
  
  // Natural variants (common in bags and shoes)
  "NAD": ["NATURAL", "NATUREL", "טבעי", "NAT", "LNA", "DNA", "MNA"],
  "NAT": ["NATURAL", "NATUREL", "טבעי", "NAD", "LNA", "DNA", "MNA", "NAVY"],
  "NATURAL": ["NAD", "NAT", "LNA", "DNA", "MNA"],
  "NATURALBLACK": ["NAD", "NAT", "NATBLACK"],
  "NATURALCOGNAC": ["NAD", "NAT", "NATCOGNAC", "COG", "NCG"],
  "NATURALOFFWHITE": ["NAD", "NAT", "OFF", "OFFWHITE"],
  
  // GUESS shoes - DARK NATURAL (DNA)
  "DNA": ["DARK NATURAL", "DARKNATURAL", "NATURAL", "NAT"],
  "DARKNATURAL": ["DNA", "DARK NATURAL", "NAT"],
  "DARK NATURAL": ["DNA", "DARKNATURAL", "NAT"],
  
  // GUESS shoes - LIGHT NATURAL (LNA)
  "LNA": ["LIGHT NATURAL", "LIGHTNATURAL", "NATURAL", "NAT"],
  "LIGHTNATURAL": ["LNA", "LIGHT NATURAL", "NAT"],
  "LIGHT NATURAL": ["LNA", "LIGHTNATURAL", "NAT"],
  
  // GUESS shoes - MEDIUM NATURAL (MNA)
  "MNA": ["MEDIUM NATURAL", "MEDIUMNATURAL", "NATURAL", "NAT"],
  "MEDIUMNATURAL": ["MNA", "MEDIUM NATURAL", "NAT"],
  "MEDIUM NATURAL": ["MNA", "MEDIUMNATURAL", "NAT"],
  
  // Brown variants
  "BRO": ["BROWN", "BRUN", "חום"],
  "BROWN": ["BRO"],
  "TAN": ["TAN", "BEIGE", "בז'"],
  "BEI": ["BEIGE", "TAN"],
  "BEIGE": ["BEI", "TAN"],
  
  // Cognac (leather color)
  "COG": ["COGNAC", "COGNAC BROWN", "קוניאק"],
  "COGNAC": ["COG"],
  "NCG": ["NATURAL COGNAC", "NATURALCOGNAC", "COG", "COGNAC"],
  
  // Blue variants
  "BLU": ["BLUE", "BLEU", "כחול"],
  "BLUE": ["BLU"],
  "NAV": ["NAVY", "NAVY BLUE", "כחול כהה", "NAT"],
  "NAVY": ["NAV", "NAT"],
  
  // GUESS shoes - DARK BLUE (DBL)
  "DBL": ["DARK BLUE", "DARKBLUE", "NAVY", "BLU"],
  "DARKBLUE": ["DBL", "DARK BLUE", "NAVY"],
  "DARK BLUE": ["DBL", "DARKBLUE", "NAVY"],
  
  // GUESS shoes - LIGHT BLUE (LBL)
  "LBL": ["LIGHT BLUE", "LIGHTBLUE", "BLU", "SKY BLUE"],
  "LIGHTBLUE": ["LBL", "LIGHT BLUE", "BLU"],
  "LIGHT BLUE": ["LBL", "LIGHTBLUE", "BLU"],
  
  // GUESS shoes - MEDIUM BLUE (MBL)
  "MBL": ["MEDIUM BLUE", "MEDIUMBLUE", "BLU"],
  "MEDIUMBLUE": ["MBL", "MEDIUM BLUE", "BLU"],
  "MEDIUM BLUE": ["MBL", "MEDIUMBLUE", "BLU"],
  
  // VILEBREQUIN specific colors (French names with spaces)
  "BLANC": ["WHITE", "WHI", "WHT", "010"],
  "BLEUMARINE": ["NAVY", "BLEU MARINE", "390"],
  "BLEU MARINE": ["NAVY", "BLEUMARINE", "390"],
  "NOIR": ["BLACK", "BLA", "BLK", "990", "399"],
  "BLEU": ["BLUE", "BLU", "315"],
  "BLEU CIEL": ["SKY BLUE", "LIGHT BLUE", "300"],
  "BLEU NEON": ["NEON BLUE", "391"],
  
  // VILEBREQUIN collection color names → base colors
  "SANTORIN": ["BLEU MARINE", "BLEU", "NAVY", "MARINE", "390"],
  "BALLERINE": ["ROSE", "PINK", "420"],
  "VERT DISCO": ["VERT", "GREEN", "VERT FONCE", "500", "599"],
  "PACIFIC": ["TURQUOISE", "BLEU CIEL", "CYAN", "312", "300"],
  "MOKA": ["GRIS", "GRIS FONCE", "GREY", "900", "930"],
  "DIVIN": ["BLEU", "BLUE", "315"],
  "ECUME": ["BLANC", "WHITE", "010"],
  "LAGON": ["TURQUOISE", "BLEU CIEL", "CYAN", "312"],
  "CARAIBES": ["TURQUOISE", "BLEU", "CYAN"],
  "CORAIL": ["ORANGE", "ROUGE", "CORAL", "303"],
  "FLAMME": ["ROUGE", "RED", "302"],
  "SOLEIL": ["JAUNE", "YELLOW", "103"],
  "BAMBOU": ["VERT", "GREEN", "500"],
  "GLACIER": ["BLEU CIEL", "LIGHT BLUE", "300"],
  "OCEAN": ["BLEU MARINE", "NAVY", "MARINE", "390"],
  "SABLE": ["BEIGE", "TAN", "CREAM"],
  "CIEL": ["BLEU CIEL", "LIGHT BLUE", "300"],
  "NUIT": ["BLEU MARINE", "NOIR", "NAVY", "390"],
  "IVOIRE": ["BLANC", "WHITE", "OFF", "OFFWHITE", "010"],
  "CERISE": ["ROUGE", "ROSE", "RED", "CHERRY"],
  "AQUA": ["TURQUOISE", "BLEU CIEL", "CYAN", "312"],
  "MENTHE": ["VERT", "GREEN", "MINT", "500"],
  "LAVANDE": ["ROSE", "PURPLE", "VIOLET"],
  "ANTHRACITE": ["GRIS FONCE", "GRIS", "900", "930"],
  "ARGENT": ["GRIS", "SILVER", "900"],
  "MARINE": ["BLEU MARINE", "NAVY", "390"],
  "TOPAZE BLEUE": ["BLUE TOPAZ", "313"],
  "BLEU HAWAI": ["HAWAII BLUE", "305"],
  
  // Green variants (GRE is also used for GREY in BAYTON images)
  "GRE": ["GREEN", "VERT", "ירוק", "GREY", "GRAY"],
  "GREEN": ["GRE", "LGN"],
  "LGN": ["LIGHT GREEN", "LIGHTGREEN", "GREEN", "GRE"],
  "LIGHTGREEN": ["LGN", "LIGHT GREEN", "GRE"],
  "LIGHT GREEN": ["LGN", "LIGHTGREEN", "GRE"],
  
  // Red/Pink variants
  "RED": ["RED", "ROUGE", "אדום", "DRE"],
  "PIN": ["PINK", "ROSE", "ורוד", "LPI"],
  "PINK": ["PIN", "LPI", "ROS"],
  "ROS": ["ROSE", "PINK", "PIN", "LPI"],
  "LPI": ["LIGHT PINK", "LIGHTPINK", "PINK", "PIN", "ROS"],
  "LIGHTPINK": ["LPI", "LIGHT PINK", "PIN"],
  "LIGHT PINK": ["LPI", "LIGHTPINK", "PIN"],
  "ROP": ["ROSE PETAL", "ROSEPETAL", "PINK", "ROS"],
  "ROSEPETAL": ["ROP", "ROSE PETAL", "PINK"],
  "ROSE PETAL": ["ROP", "ROSEPETAL", "PINK"],
  
  // Yellow/Gold variants
  "YEL": ["YELLOW", "JAUNE", "צהוב"],
  "YELLOW": ["YEL"],
  "GOL": ["GOLD", "OR", "זהב"],
  "GOLD": ["GOL"],
  
  // Gray/Silver variants
  "GRA": ["GRAY", "GREY", "GRIS", "אפור"],
  "GRY": ["GRAY", "GREY", "GRIS", "אפור"],
  "GRAY": ["GRA", "GRY"],
  "GREY": ["GRA", "GRY", "GRE"],
  "SIL": ["SILVER", "ARGENT", "כסף"],
  "SILVER": ["SIL"],
  "DGR": ["DARK GRAY", "GRIS FONCÉ", "אפור כהה"],
  "LGR": ["LIGHT GRAY", "LIGHT GREY", "GRIS CLAIR", "אפור בהיר", "LIG"],
  "LIG": ["LIGHT GRAY", "LIGHT GREY", "LGR"],
  "LIGHT GREY": ["LGR", "LIG", "LIGHT GRAY"],
  "LIGHT GRAY": ["LGR", "LIG", "LIGHT GREY"],
  
  // Purple variants
  "PUR": ["PURPLE", "VIOLET", "סגול"],
  "PURPLE": ["PUR"],
  
  // Orange variants
  "ORA": ["ORANGE", "כתום"],
  "ORANGE": ["ORA"],
  
  // Other common colors
  "IVO": ["IVORY", "IVOIRE", "שנהב", "WHI", "WHITE"],
  "IVORY": ["IVO", "WHI"],
  "CAM": ["CAMEL", "CHAMEAU", "גמל"],
  "CAMEL": ["CAM"],
  "KHA": ["KHAKI", "חאקי", "OLIVE"],
  "KHAKI": ["KHA", "OLIVE"],
  "CHOCOLATE": ["CHO", "BROWN", "BRO", "DARK BROWN"],
  "CHO": ["CHOCOLATE", "BROWN", "DARK BROWN"],
  "LIS": ["LIGHT", "LISO"],
  "NRC": ["NATURAL ROSE COGNAC", "ROSECOGNAC"],
  "NTB": ["NATURAL TAN BROWN", "TANBROWN"],
  "LUG": ["LUGGAGE", "LUGGAGE BROWN", "LIGHT TAUPE", "LIGHTTAUPE", "LIGHTTAUPELOGO", "TAUPE"],
  "LIGHTTAUPE": ["LUG", "LUGGAGE", "TAUPE"],
  "LIGHTTAUPELOGO": ["LUG", "LUGGAGE", "TAUPE", "LIGHTTAUPE"],
  "TAUPE": ["LUG", "LIGHTTAUPE", "TAU"],
  "TAU": ["TAUPE", "LUG", "LIGHTTAUPE"],
  "LOGO": ["LOGO", "WITH LOGO"],
  
  // Special codes from image files
  "CAR": ["CARAMEL", "CARAMEL MULTI", "CAM"],
  "CARAMEL": ["CAR", "CAM"],
  "CTN": ["COTTON", "CRE", "OFF"],
  "COTTON": ["CTN", "CRE"],
  "DKO": ["DARK", "COAL", "CHARCOAL"],
  "COAL": ["DKO", "CHARCOAL", "GRY"],
  "CHC": ["CHALK", "BEIGE WHITE", "BEIGEWHITE", "OFF"],
  "CHALK": ["CHC", "OFF", "BEI"],
  "LGW": ["LOGO WHITE", "LOGOWHITE", "WHI"],
  "RUR": ["RUST", "RUSTIC", "BRO"],
  
  // Color + number patterns (strip numbers for matching)
  "POWDERBLUE": ["LBL", "LIGHT BLUE", "BLU"],
  "LAVENDER": ["PUR", "PURPLE", "LPI"],
  "LAVENDERGREY": ["PUR", "GRY", "GREY"],
};

/**
 * Extract base color (letters) and number from color code
 * e.g., "BLK01" -> { base: "BLK", number: "01" }
 * e.g., "BLACK 001" -> { base: "BLACK", number: "001" }
 */
function extractColorParts(color: string): { base: string; number: string } {
  const normalized = color.toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  // Match letters followed by optional numbers
  const match = normalized.match(/^([A-Z]+)(\d*)$/);
  if (match) {
    return { base: match[1], number: match[2] || "" };
  }
  
  // If format is different, try to extract differently
  // e.g., "200" alone, or mixed format
  const lettersOnly = normalized.replace(/\d/g, "");
  const numbersOnly = normalized.replace(/[A-Z]/g, "");
  
  return { base: lettersOnly || normalized, number: numbersOnly };
}

/**
 * Try to match image color abbreviation with product color
 * INTELLIGENT matching: handles abbreviated codes like BLK01 -> BLACK 001
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
  
  // Normalized exact match
  if (imgNormalized === prodNormalized) return true;
  
  // Extract base color and number
  const imgParts = extractColorParts(imgColorUpper);
  const prodParts = extractColorParts(prodColorUpper);
  
  // COLOR_MAP check: check if base colors are equivalent via COLOR_MAP
  const isColorEquivalent = (color1: string, color2: string): boolean => {
    if (color1 === color2) return true;
    
    // Direct COLOR_MAP lookup
    const mappedColors = COLOR_MAP[color1];
    if (mappedColors) {
      for (const mapped of mappedColors) {
        const mappedNorm = cleanColor(mapped);
        if (mappedNorm === color2) {
          return true;
        }
      }
    }
    return false;
  };
  
  // Try matching base colors (ignoring numbers for flexibility)
  if (imgParts.base && prodParts.base) {
    // Check if base colors match via COLOR_MAP
    if (isColorEquivalent(imgParts.base, prodParts.base)) {
      // Base colors match! Now check if numbers are compatible
      // Numbers are compatible if:
      // 1. Same number (01 == 001 after trimming leading zeros)
      // 2. One has no number
      // 3. Numbers end with same digits
      
      const imgNum = imgParts.number.replace(/^0+/, "") || "0";
      const prodNum = prodParts.number.replace(/^0+/, "") || "0";
      
      if (imgNum === prodNum || imgParts.number === "" || prodParts.number === "") {
        return true;
      }
      
      // Numbers are different but base colors match - still a good match for most cases
      // Because often the number is just a variant (01, 02 for different shades of same color)
      return true;
    }
    
    // Try reverse direction
    if (isColorEquivalent(prodParts.base, imgParts.base)) {
      return true;
    }
  }
  
  // Try both directions with full normalized colors
  if (isColorEquivalent(imgNormalized, prodNormalized)) return true;
  if (isColorEquivalent(prodNormalized, imgNormalized)) return true;
  
  // Last resort: Check if a short color code (3-4 chars) is contained in a longer color name
  if (imgNormalized.length <= 4 && prodNormalized.length > imgNormalized.length) {
    if (prodNormalized.includes(imgNormalized)) {
      return true;
    }
  }
  if (prodNormalized.length <= 4 && imgNormalized.length > prodNormalized.length) {
    if (imgNormalized.includes(prodNormalized)) {
      return true;
    }
  }
  
  // Check if base of short code is in the longer color
  if (imgParts.base.length >= 2 && imgParts.base.length <= 4) {
    if (prodParts.base.startsWith(imgParts.base) || prodNormalized.includes(imgParts.base)) {
      return true;
    }
  }
  if (prodParts.base.length >= 2 && prodParts.base.length <= 4) {
    if (imgParts.base.startsWith(prodParts.base) || imgNormalized.includes(prodParts.base)) {
      return true;
    }
  }
  
  // No match found - return false
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
    
    // Fetch ALL images from image_index using pagination (Supabase has row limits)
    let allIndexData: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from('image_index')
        .select('model_ref, color, url, filename')
        .range(offset, offset + pageSize - 1)
        .order('id', { ascending: true });
      
      if (pageError) {
        console.warn(`[fetchProducts] Error fetching page at offset ${offset}:`, pageError.message);
        break;
      }
      
      if (!pageData || pageData.length === 0) {
        hasMore = false;
      } else {
        allIndexData = allIndexData.concat(pageData);
        offset += pageSize;
        if (pageData.length < pageSize) {
          hasMore = false;
        }
      }
    }
    
    console.log(`[fetchProducts] ✅ Loaded ${allIndexData.length} images from index table (with pagination)`);
    
    // Debug: Count SAM EDELMAN images
    const samEdelmanImages = allIndexData.filter((img: any) => img.model_ref?.startsWith('HBSE-') || img.model_ref?.startsWith('FESE-') || img.model_ref?.startsWith('SBSE-'));
    console.log(`[fetchProducts] SAM EDELMAN images loaded: ${samEdelmanImages.length}`);
    if (samEdelmanImages.length > 0) {
      console.log(`[fetchProducts] Sample SAM EDELMAN images:`, samEdelmanImages.slice(0, 5).map((img: any) => ({ model_ref: img.model_ref, color: img.color })));
    }
    
    const indexData = allIndexData;
    const indexError: any = null;
    
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
      let modelRef = file.modelRef?.toUpperCase().trim();
      let color = file.color?.toUpperCase().trim();
      let url = file.url;
      
      // Fallback to parsing if not from index
      if (!modelRef || !color) {
        const parsed = parseImageFilename(file.name);
        if (!parsed) continue;
        modelRef = parsed.modelRef.toUpperCase().trim();
        color = parsed.color.toUpperCase().trim();
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
      const productBrand = (productData as any).brand || "";
      // Use colorCode from itemCode (e.g., "BLO" from "PD760221-BLO-OS") - more reliable for matching
      const productColorCode = (productData as any).colorCode?.toUpperCase().trim() || "";
      
      // Try exact match with colorCode first (most reliable)
      let images: { imageUrl: string; gallery: string[] } | undefined;
      
      // Debug log for specific products
      const isDebugProduct = productModelRef === "PD760221" || productModelRef === "CV866522" || productModelRef.startsWith("HBSE-");
      if (isDebugProduct) {
        console.log(`[DEBUG ${productModelRef}-${productColor}] brand: "${productBrand}", productColorCode: "${productColorCode}", productColor: "${productColor}"`);
      }
      
      // Try exact match with colorCode first (most reliable)
      if (productColorCode) {
        const keyWithCode = `${productModelRef}|${productColorCode}`;
        if (isDebugProduct) {
          console.log(`[DEBUG ${productModelRef}-${productColor}] Looking for exact key: "${keyWithCode}"`);
        }
        images = imageMap.get(keyWithCode);
        if (images) {
          exactMatches++;
          matchedCount++;
          if (isDebugProduct) {
            console.log(`[DEBUG ${productModelRef}-${productColor}] ✅ FOUND via colorCode exact match!`);
          }
        }
      }
      
      // Try exact match with full color name (both original and normalized)
      if (!images) {
        // Try with original color first
        const key = `${productModelRef}|${productColor}`;
        if (isDebugProduct) {
          console.log(`[DEBUG ${productModelRef}-${productColor}] Looking for exact key: "${key}"`);
        }
        images = imageMap.get(key);
        if (images) {
          exactMatches++;
          matchedCount++;
          if (isDebugProduct) {
            console.log(`[DEBUG ${productModelRef}-${productColor}] ✅ FOUND via exact color match!`);
          }
        }
      }
      
      // Try normalized color if exact match failed
      if (!images) {
        const normalizedColor = productColor.replace(/[^A-Z0-9]/g, "").replace(/OS$/, "").replace(/LOGO$/, "");
        const keyNormalized = `${productModelRef}|${normalizedColor}`;
        if (isDebugProduct && normalizedColor !== productColor) {
          console.log(`[DEBUG ${productModelRef}-${productColor}] Looking for normalized key: "${keyNormalized}"`);
        }
        images = imageMap.get(keyNormalized);
        if (images) {
          exactMatches++;
          matchedCount++;
          if (isDebugProduct) {
            console.log(`[DEBUG ${productModelRef}-${productColor}] ✅ FOUND via normalized color match!`);
          }
        }
      }
      
      // Look up by modelRef in index and try color matching
      const modelRefImages = modelRefIndex.get(productModelRef);
      
      // Special handling for VILEBREQUIN and SAM EDELMAN:
      // Match by COLOR FIRST (like for other brands) to show correct images per color
      // Only fall back to showing all images if no color match is found
      const isVilebrequinOrSam = productBrand === "VILEBREQUIN" || productBrand === "SAM EDELMAN";
      const shouldDebugVile = isVilebrequinOrSam && (productModelRef === "PLTH2N00" || productModelRef === "PYRE9O00");
      
      if (shouldDebugVile || isDebugProduct) {
        console.log(`[DEBUG ${productModelRef}] Brand: "${productBrand}", Color: "${productColor}"`);
        console.log(`[DEBUG ${productModelRef}] modelRefImages found? ${modelRefImages ? modelRefImages.length : 'null'}`);
        if (modelRefImages) {
          console.log(`[DEBUG ${productModelRef}] Available image colors:`, modelRefImages.map(i => i.color));
        }
      }
      
      if (isVilebrequinOrSam && modelRefImages && modelRefImages.length > 0) {
        // First try to match by color (exact or normalized)
        const normalizedProductColor = productColor.replace(/[^A-Z0-9]/g, "").replace(/OS$/, "");
        
        for (const item of modelRefImages) {
          const normalizedItemColor = item.color.replace(/[^A-Z0-9]/g, "").replace(/OS$/, "");
          const directMatch = item.color === productColor || normalizedItemColor === normalizedProductColor;
          const colorMapMatch = matchesColor(item.color, productColor);
          
          if (shouldDebugVile || isDebugProduct) {
            console.log(`[DEBUG ${productModelRef}-${productColor}] Testing: imageColor="${item.color}" (norm: "${normalizedItemColor}") vs productColor="${productColor}" (norm: "${normalizedProductColor}")`);
            console.log(`[DEBUG ${productModelRef}-${productColor}] direct=${directMatch}, colorMap=${colorMapMatch}`);
          }
          
          if (directMatch || colorMapMatch) {
            images = item.images;
            colorMatches++;
            matchedCount++;
            if (shouldDebugVile || isDebugProduct) {
              console.log(`[DEBUG ${productModelRef}-${productColor}] ✅ MATCHED! Using ${item.images.gallery?.length || 1} images for color "${item.color}"`);
            }
            break; // Stop once we found a color match
          }
        }
        
        // Fallback: if no color match found and only one color available, use it
        if (!images && modelRefImages.length === 1) {
          images = modelRefImages[0].images;
          modelOnlyMatches++;
          matchedCount++;
          if (shouldDebugVile || isDebugProduct) {
            console.log(`[DEBUG ${productModelRef}-${productColor}] ⚠️ No color match, using only available color: "${modelRefImages[0].color}"`);
          }
        }
        
        // Fallback 2: use ALL images if multiple colors and no match (backward compatibility)
        if (!images && modelRefImages.length > 1) {
          const allUrls: string[] = [];
          for (const item of modelRefImages) {
            if (item.images.gallery && item.images.gallery.length > 0) {
              allUrls.push(...item.images.gallery);
            } else if (item.images.imageUrl) {
              allUrls.push(item.images.imageUrl);
            }
          }
          const uniqueUrls = Array.from(new Set(allUrls));
          if (uniqueUrls.length > 0) {
            images = {
              imageUrl: uniqueUrls[0],
              gallery: uniqueUrls,
            };
            modelOnlyMatches++;
            matchedCount++;
            if (shouldDebugVile || isDebugProduct) {
              console.log(`[DEBUG ${productModelRef}-${productColor}] ⚠️ No color match, using ALL images as fallback (${uniqueUrls.length} images)`);
            }
          }
        }
      }
      
      // For other brands (GUESS), try color matching
      if (!images && modelRefImages && modelRefImages.length > 0) {
        if (isDebugProduct) {
          console.log(`[DEBUG ${productModelRef}] modelRefImages count: ${modelRefImages.length}`);
          console.log(`[DEBUG ${productModelRef}] Available colors:`, modelRefImages.map(i => i.color));
          console.log(`[DEBUG ${productModelRef}-${productColor}] Available image colors:`, modelRefImages.map(i => i.color));
        }
        
        // First try with colorCode (e.g., "BLO", "OFF", "COG")
        // IMPORTANT: Only match if colors truly match - don't use wrong color
        if (productColorCode) {
          for (const item of modelRefImages) {
            const directMatch = item.color === productColorCode;
            const colorMapMatch = matchesColor(item.color, productColorCode);
            if (isDebugProduct) {
              console.log(`[DEBUG ${productModelRef}-${productColor}] Testing image color "${item.color}" vs productColorCode "${productColorCode}": direct=${directMatch}, colorMap=${colorMapMatch}`);
            }
            // Only use this image if it truly matches
            if (directMatch || colorMapMatch) {
              images = item.images;
              colorMatches++;
              matchedCount++;
              if (isDebugProduct) {
                console.log(`[DEBUG ${productModelRef}-${productColor}] ✅ MATCHED via colorCode "${productColorCode}"! Using image for color "${item.color}":`, item.images.imageUrl);
              }
              break; // Stop searching once we found a match
            }
          }
        }
        
        // Then try with full color name (normalized for comparison)
        if (!images) {
          const normalizedProductColor = productColor.replace(/[^A-Z0-9]/g, "").replace(/OS$/, "").replace(/LOGO$/, "");
          for (const item of modelRefImages) {
            const normalizedItemColor = item.color.replace(/[^A-Z0-9]/g, "").replace(/OS$/, "").replace(/LOGO$/, "");
            const directMatch = normalizedItemColor === normalizedProductColor || item.color === productColor;
            const colorMapMatch = matchesColor(item.color, productColor);
            if (isDebugProduct) {
              console.log(`[DEBUG ${productModelRef}-${productColor}] Testing image color "${item.color}" (normalized: "${normalizedItemColor}") vs productColor "${productColor}" (normalized: "${normalizedProductColor}"): direct=${directMatch}, colorMap=${colorMapMatch}`);
            }
            // Only use this image if it truly matches
            if (directMatch || colorMapMatch) {
              images = item.images;
              colorMatches++;
              matchedCount++;
              if (isDebugProduct) {
                console.log(`[DEBUG ${productModelRef}-${productColor}] ✅ MATCHED via productColor "${productColor}"! Using image for color "${item.color}":`, item.images.imageUrl);
              }
              break; // Stop searching once we found a match
            }
          }
        }
          
        // Smart fallback: Only use fallback if:
        // 1. There's only ONE unique color available AND
        // 2. The product's colorCode (if exists) doesn't indicate a different specific color
        // This prevents CV866522-COG from using CV866522-OFFWHITE images
        if (!images) {
          // Get unique colors (normalized to avoid duplicates like "OFF" vs "OFFWHITE" counting as 2)
          const uniqueColors = new Set<string>();
          for (const item of modelRefImages) {
            const normalized = item.color.replace(/[^A-Z0-9]/g, "").replace(/OS$/, "").replace(/LOGO$/, "");
            uniqueColors.add(normalized);
          }
          
          const singleColor = uniqueColors.size === 1 ? Array.from(uniqueColors)[0] : null;
          
          // Check if product has a specific colorCode that differs from available color
          let canUseFallback = false;
          if (singleColor) {
            if (productColorCode) {
              // Product has specific colorCode (e.g., "COG", "BLA", "OFF")
              // Only use fallback if this colorCode could match the available color
              const colorCodeNorm = productColorCode.replace(/[^A-Z0-9]/g, "").replace(/OS$/, "").replace(/LOGO$/, "");
              // Check if colorCode matches available color via matchesColor
              const availableColorItem = modelRefImages.find(item => {
                const normalized = item.color.replace(/[^A-Z0-9]/g, "").replace(/OS$/, "").replace(/LOGO$/, "");
                return normalized === singleColor;
              });
              if (availableColorItem && matchesColor(availableColorItem.color, productColorCode)) {
                // colorCode matches available color (e.g., "OFF" matches "OFFWHITE")
                canUseFallback = true;
              } else {
                // colorCode is different from available color (e.g., "COG" doesn't match "OFFWHITE")
                canUseFallback = false;
                if (isDebugProduct) {
                  console.log(`[DEBUG ${productModelRef}-${productColor}] ❌ colorCode "${productColorCode}" (normalized: "${colorCodeNorm}") doesn't match available color "${singleColor}" - NOT using fallback`);
                }
              }
            } else {
              // No colorCode, safe to use fallback for single-color products (like shoes)
              canUseFallback = true;
            }
          }
          
          if (canUseFallback && singleColor) {
            // Only ONE unique color available and colorCode matches (or no colorCode) - safe to use as fallback
            images = modelRefImages[0].images;
            modelOnlyMatches++;
            if (isDebugProduct) {
              console.log(`[DEBUG ${productModelRef}-${productColor}] ⚠️  NO COLOR MATCH but only 1 unique color available (${singleColor}) - using as fallback`);
            }
          } else {
            // Multiple colors or colorCode mismatch - don't use fallback
            if (isDebugProduct) {
              console.log(`[DEBUG ${productModelRef}-${productColor}] ❌ NO COLOR MATCH and ${uniqueColors.size} unique colors available (${Array.from(uniqueColors).join(", ")}) - NOT using fallback`);
            }
          }
        } else if (!images && modelRefImages && modelRefImages.length === 0) {
          if (isDebugProduct) {
            console.log(`[DEBUG ${productModelRef}-${productColor}] ❌ NO IMAGES AVAILABLE for this modelRef`);
          }
        }
      }
      
      // ========== FALLBACK: Try similar ModelRef (same prefix) ==========
      if (!images && productModelRef.length >= 6) {
        const prefix = productModelRef.substring(0, Math.min(7, productModelRef.length - 1));
        
        // Find similar modelRefs with same prefix
        for (const [indexModelRef, indexImages] of modelRefIndex.entries()) {
          if (indexModelRef !== productModelRef && indexModelRef.startsWith(prefix)) {
            // Found a similar modelRef! Use its images
            // Try to match color first
            for (const item of indexImages) {
              if (matchesColor(item.color, productColor) || matchesColor(item.color, productColorCode)) {
                images = item.images;
                colorMatches++;
                if (isDebugProduct) {
                  console.log(`[DEBUG ${productModelRef}-${productColor}] ✅ SIMILAR ModelRef MATCH: ${indexModelRef} (${item.color})`);
                }
                break;
              }
            }
            
            // If no color match but only 1 color available, use it
            if (!images && indexImages.length > 0) {
              const uniqueColors = new Set(indexImages.map(i => i.color));
              if (uniqueColors.size === 1) {
                images = indexImages[0].images;
                modelOnlyMatches++;
                if (isDebugProduct) {
                  console.log(`[DEBUG ${productModelRef}-${productColor}] ⚠️ SIMILAR ModelRef: ${indexModelRef} (single color: ${indexImages[0].color})`);
                }
              }
            }
            
            if (images) break;
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
