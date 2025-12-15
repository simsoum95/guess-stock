import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing Supabase credentials" });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // 1. Create table if not exists
    const { error: createTableError } = await supabase.rpc('create_image_index_table');
    
    // 2. List all images with pagination
    const BATCH_SIZE = 1000;
    let offset = 0;
    let hasMore = true;
    const allImages: { filename: string; modelRef: string; color: string; url: string }[] = [];
    
    while (hasMore && allImages.length < 25000) {
      const { data: items, error } = await supabase.storage
        .from("guess-images")
        .list("products", {
          limit: BATCH_SIZE,
          offset: offset,
          sortBy: { column: "name", order: "asc" }
        });
      
      if (error || !items || items.length === 0) {
        hasMore = false;
        break;
      }
      
      for (const item of items) {
        if (!item.name.includes(".")) continue;
        
        const parsed = parseFilename(item.name);
        if (!parsed) continue;
        
        const { data: urlData } = supabase.storage
          .from("guess-images")
          .getPublicUrl(`products/${item.name}`);
        
        allImages.push({
          filename: item.name,
          modelRef: parsed.modelRef,
          color: parsed.color,
          url: urlData.publicUrl
        });
      }
      
      if (items.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        offset += BATCH_SIZE;
      }
    }
    
    // 3. Clear existing index
    await supabase.from('image_index').delete().neq('id', 0);
    
    // 4. Insert in batches
    const BATCH_INSERT = 500;
    let inserted = 0;
    
    for (let i = 0; i < allImages.length; i += BATCH_INSERT) {
      const batch = allImages.slice(i, i + BATCH_INSERT).map(img => ({
        model_ref: img.modelRef,
        color: img.color,
        filename: img.filename,
        url: img.url
      }));
      
      const { error } = await supabase
        .from('image_index')
        .upsert(batch, { onConflict: 'filename' });
      
      if (!error) {
        inserted += batch.length;
      }
    }
    
    return NextResponse.json({
      success: true,
      totalImages: allImages.length,
      inserted,
      message: `Index created with ${inserted} images`
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}

function parseFilename(filename: string): { modelRef: string; color: string } | null {
  const baseName = filename.replace(/\.[^/.]+$/, "");
  
  let parts: string[];
  
  if (baseName.includes("-")) {
    parts = baseName.split("-");
  } else if (baseName.includes("_")) {
    parts = baseName.split("_");
  } else {
    return null;
  }
  
  if (parts.length >= 2) {
    return {
      modelRef: parts[0].trim().toUpperCase(),
      color: parts[1].trim().toUpperCase()
    };
  }
  
  return null;
}

