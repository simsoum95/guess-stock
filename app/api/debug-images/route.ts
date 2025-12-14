import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modelRef = searchParams.get("modelRef") || "CV866522";
  
  try {
    // List all files in products folder
    const { data: files, error } = await supabase.storage
      .from("guess-images")
      .list("products", { limit: 1000 });
    
    if (error) {
      return NextResponse.json({ error: error.message });
    }

    // Filter for modelRef
    const matchingFiles = files?.filter(f => 
      f.name.toUpperCase().includes(modelRef.toUpperCase())
    ) || [];

    // Get public URLs
    const imagesWithUrls = matchingFiles.map(f => {
      const { data } = supabase.storage
        .from("guess-images")
        .getPublicUrl(`products/${f.name}`);
      return {
        name: f.name,
        url: data.publicUrl
      };
    });

    return NextResponse.json({
      modelRef,
      totalFilesInProducts: files?.length || 0,
      matchingFiles: matchingFiles.length,
      images: imagesWithUrls
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}

