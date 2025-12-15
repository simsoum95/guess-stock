import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  
  try {
    const BATCH_SIZE = 1000;
    let offset = 0;
    let totalFiles = 0;
    let hasMore = true;
    const batches: number[] = [];
    const matchingFiles: string[] = [];
    
    while (hasMore && batches.length < 25) {
      const { data: items, error } = await supabase.storage
        .from("guess-images")
        .list("products", {
          limit: BATCH_SIZE,
          offset: offset,
          sortBy: { column: "name", order: "asc" }
        });
      
      if (error) {
        return NextResponse.json({ 
          error: error.message, 
          batchesCompleted: batches.length,
          totalFiles 
        });
      }
      
      if (!items || items.length === 0) {
        hasMore = false;
        break;
      }
      
      const fileCount = items.filter(i => i.name.includes(".")).length;
      batches.push(fileCount);
      totalFiles += fileCount;
      
      // Search for matching files
      if (search) {
        for (const item of items) {
          if (item.name.toUpperCase().includes(search.toUpperCase())) {
            matchingFiles.push(item.name);
          }
        }
      }
      
      if (items.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        offset += BATCH_SIZE;
      }
    }
    
    return NextResponse.json({
      totalFiles,
      batchCount: batches.length,
      batches,
      search: search || null,
      matchingCount: matchingFiles.length,
      matchingFiles: matchingFiles.slice(0, 20) // First 20 matches
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}

