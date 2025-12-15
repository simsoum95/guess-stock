import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

function parseImageFilename(filename: string) {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
  
  // Try underscore pattern: MODELREF_COLOR_NAME_SUFFIX
  const underscoreParts = nameWithoutExt.split('_');
  if (underscoreParts.length >= 2) {
    const modelRef = underscoreParts[0].toUpperCase();
    const color = underscoreParts[1].toUpperCase();
    if (/^[A-Z0-9]{5,}$/.test(modelRef) && color.length >= 2) {
      return { modelRef, color };
    }
  }
  
  // Try dash pattern: MODELREF-COLOR-NAME-SUFFIX
  const dashParts = nameWithoutExt.split('-');
  if (dashParts.length >= 2) {
    const modelRef = dashParts[0].toUpperCase();
    const color = dashParts[1].toUpperCase();
    if (/^[A-Z0-9]{5,}$/.test(modelRef) && color.length >= 2) {
      return { modelRef, color };
    }
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testModelRef = searchParams.get("modelRef") || "PD760221";
  
  try {
    // Step 1: Get images from image_index
    console.log("[debug-imagemap] Fetching from image_index...");
    const { data: indexData, error: indexError } = await supabase
      .from('image_index')
      .select('model_ref, color, url, filename')
      .limit(50000);
    
    if (indexError) {
      return NextResponse.json({ 
        error: "Index error", 
        message: indexError.message 
      }, { status: 500 });
    }
    
    console.log(`[debug-imagemap] Got ${indexData?.length || 0} rows from index`);
    
    // Step 2: Build imageMap exactly like fetchProducts
    const productImages = new Map<string, string[]>();
    
    for (const row of indexData || []) {
      const modelRef = row.model_ref?.toUpperCase().trim();
      const color = row.color?.toUpperCase().trim();
      
      if (!modelRef || !color) continue;
      
      const key = `${modelRef}|${color}`;
      if (!productImages.has(key)) {
        productImages.set(key, []);
      }
      productImages.get(key)!.push(row.url);
    }
    
    // Find keys matching testModelRef
    const matchingKeys = Array.from(productImages.keys()).filter(k => 
      k.startsWith(testModelRef.toUpperCase())
    );
    
    // Get sample keys
    const sampleKeys = Array.from(productImages.keys()).slice(0, 20);
    
    return NextResponse.json({
      totalRowsFromIndex: indexData?.length || 0,
      imageMapSize: productImages.size,
      testModelRef,
      matchingKeysForModelRef: matchingKeys,
      matchingKeysCount: matchingKeys.length,
      sampleKeys,
      testLookup: {
        "PD760221|BLO": productImages.has("PD760221|BLO"),
        "PD760221|LUG": productImages.has("PD760221|LUG"),
        "PD760221|GBL": productImages.has("PD760221|GBL"),
      }
    });
  } catch (error: any) {
    console.error("[debug-imagemap] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

