import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const modelRef = "CV866522";

  try {
    // Query image_index for this modelRef
    const { data: imageIndexData, error: indexError } = await supabase
      .from('image_index')
      .select('model_ref, color, filename, url')
      .ilike('model_ref', modelRef)
      .order('color', { ascending: true });

    if (indexError) {
      return NextResponse.json({ 
        error: "Error querying image_index", 
        details: indexError.message 
      }, { status: 500 });
    }

    // Group by color
    const byColor = new Map<string, any[]>();
    if (imageIndexData) {
      for (const item of imageIndexData) {
        const color = item.color?.toUpperCase().trim() || 'UNKNOWN';
        if (!byColor.has(color)) {
          byColor.set(color, []);
        }
        byColor.get(color)!.push({
          filename: item.filename,
          url: item.url
        });
      }
    }

    // Also check what products exist for this modelRef
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('modelRef, color, itemCode')
      .ilike('modelRef', modelRef)
      .limit(10);

    return NextResponse.json({
      modelRef,
      imageIndexCount: imageIndexData?.length || 0,
      imagesByColor: Object.fromEntries(byColor),
      colorsInIndex: Array.from(byColor.keys()),
      productsFromSheet: products?.map(p => ({
        color: p.color,
        itemCode: p.itemCode,
        colorFromItemCode: p.itemCode?.match(/-([A-Z0-9]{2,4})-/)?.[1] || null
      })) || [],
      rawImageIndexData: imageIndexData?.slice(0, 20) // First 20 for debugging
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

