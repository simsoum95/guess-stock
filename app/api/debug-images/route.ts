import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

// List files with pagination - limited batches to avoid timeout
async function listAllFiles(folder: string, maxBatches: number = 15): Promise<{ files: string[], totalBatches: number }> {
  const allFiles: string[] = [];
  const BATCH_SIZE = 1000;
  let offset = 0;
  let batchCount = 0;
  let hasMore = true;

  while (hasMore && batchCount < maxBatches) {
    const { data: items, error } = await supabase.storage
      .from("guess-images")
      .list(folder, { limit: BATCH_SIZE, offset });

    batchCount++;

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

  return { files: allFiles, totalBatches: batchCount };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modelRef = searchParams.get("modelRef") || "CV866522";
  
  try {
    // List ALL files with pagination
    const { files, totalBatches } = await listAllFiles("products", 15);

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
      totalBatches,
      matchingFiles: matchingFiles.length,
      images: imagesWithUrls
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}

