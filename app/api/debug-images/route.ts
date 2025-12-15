import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modelRef = searchParams.get("modelRef") || "CV866522";
  
  try {
    // Use image_index table (FAST!)
    const { data: indexData, error: indexError } = await supabase
      .from('image_index')
      .select('model_ref, color, filename, url')
      .ilike('model_ref', `%${modelRef}%`)
      .limit(100);
    
    if (indexError) {
      return NextResponse.json({
        method: "image_index (error)",
        error: indexError.message,
        modelRef,
        totalInIndex: 0,
        matchingFiles: 0,
        images: []
      });
    }
    
    // Get total count
    const { count } = await supabase
      .from('image_index')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      method: "image_index table",
      modelRef,
      totalInIndex: count || 0,
      matchingFiles: indexData?.length || 0,
      images: indexData?.map(row => ({
        name: row.filename,
        url: row.url,
        color: row.color
      })) || []
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}

