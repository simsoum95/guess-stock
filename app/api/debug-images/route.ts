import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modelRef = searchParams.get("modelRef") || "CV866522";
  
  try {
    // Use RPC function to get all images (fast SQL query)
    const { data: rpcData, error: rpcError } = await supabase.rpc('list_all_product_images');
    
    let allFiles: string[] = [];
    let method = "RPC";
    
    if (rpcError) {
      method = "Storage API (fallback)";
      // Fallback to Storage API
      const { data: items } = await supabase.storage
        .from("guess-images")
        .list("products", { limit: 1000 });
      
      if (items) {
        allFiles = items.filter(i => i.name.includes(".")).map(i => i.name);
      }
    } else if (rpcData && Array.isArray(rpcData)) {
      allFiles = rpcData.map((row: { filename: string }) => row.filename);
    }

    // Filter for modelRef
    const matchingFiles = allFiles.filter(f => 
      f.toUpperCase().includes(modelRef.toUpperCase())
    );

    // Get public URLs
    const imagesWithUrls = matchingFiles.map(f => {
      const { data } = supabase.storage
        .from("guess-images")
        .getPublicUrl(`products/${f}`);
      return {
        name: f,
        url: data.publicUrl
      };
    });

    return NextResponse.json({
      method,
      modelRef,
      totalFilesFound: allFiles.length,
      matchingFiles: matchingFiles.length,
      rpcError: rpcError?.message || null,
      images: imagesWithUrls
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}

