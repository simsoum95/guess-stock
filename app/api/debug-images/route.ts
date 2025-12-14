import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

// List ALL files with pagination
async function listAllFiles(folder: string): Promise<string[]> {
  const allFiles: string[] = [];
  const BATCH_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: items, error } = await supabase.storage
      .from("guess-images")
      .list(folder, { limit: BATCH_SIZE, offset });

    if (error || !items || items.length === 0) {
      hasMore = false;
      break;
    }

    for (const item of items) {
      if (item.name.includes(".")) {
        allFiles.push(item.name);
      }
    }

    if (items.length < BATCH_SIZE) {
      hasMore = false;
    } else {
      offset += BATCH_SIZE;
    }
  }

  return allFiles;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modelRef = searchParams.get("modelRef") || "CV866522";
  
  try {
    // List ALL files with pagination
    const files = await listAllFiles("products");

    // Filter for modelRef
    const matchingFiles = files.filter(f => 
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
      modelRef,
      totalFilesInProducts: files.length,
      matchingFiles: matchingFiles.length,
      images: imagesWithUrls
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}

