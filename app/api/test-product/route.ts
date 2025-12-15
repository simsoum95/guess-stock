import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelRef = searchParams.get("modelRef") || "PD760221";
  
  try {
    // Step 1: Get images from index for this modelRef
    const { data: indexData, error: indexError } = await supabase
      .from('image_index')
      .select('model_ref, color, url, filename')
      .ilike('model_ref', `%${modelRef}%`)
      .limit(50);
    
    if (indexError) {
      return NextResponse.json({ error: "Index query failed: " + indexError.message });
    }
    
    // Step 2: Build imageMap like fetchProducts does
    const imageMap = new Map<string, { imageUrl: string; gallery: string[] }>();
    const productImages = new Map<string, string[]>();
    
    for (const row of indexData || []) {
      const key = `${row.model_ref}|${row.color}`;
      if (!productImages.has(key)) {
        productImages.set(key, []);
      }
      productImages.get(key)!.push(row.url);
    }
    
    productImages.forEach((urls, key) => {
      // Sort: F images first
      const sorted = urls.sort((a, b) => {
        const aEndsF = /_F\./i.test(a) || /-F\./i.test(a);
        const bEndsF = /_F\./i.test(b) || /-F\./i.test(b);
        if (aEndsF && !bEndsF) return -1;
        if (!aEndsF && bEndsF) return 1;
        return 0;
      });
      imageMap.set(key, { imageUrl: sorted[0], gallery: sorted });
    });
    
    // Step 3: Test matching with colorCodes
    const testColors = ["BLO", "LUG", "GBL", "BLACK LOGO", "LIGHT TAUPE LOGO"];
    const matchTests: any[] = [];
    
    for (const color of testColors) {
      const key1 = `${modelRef.toUpperCase()}|${color}`;
      const found1 = imageMap.get(key1);
      matchTests.push({
        key: key1,
        found: !!found1,
        imageUrl: found1?.imageUrl || null
      });
    }
    
    return NextResponse.json({
      modelRef,
      imagesInIndex: indexData?.length || 0,
      imageMapKeys: Array.from(imageMap.keys()),
      imageMapSize: imageMap.size,
      matchTests,
      sampleImages: (indexData || []).slice(0, 5).map(r => ({
        model_ref: r.model_ref,
        color: r.color,
        filename: r.filename
      }))
    });
  } catch (error: any) {
    console.error("[test-product] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

