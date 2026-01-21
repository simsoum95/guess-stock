import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Count images from image_index table
    const { count: indexCount, error: countError } = await supabase
      .from('image_index')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error("Error counting image_index:", countError);
    }

    // 2. Get detailed stats by brand/modelRef pattern
    const { data: allImages, error: listError } = await supabase
      .from('image_index')
      .select('model_ref, color, filename, url');
    
    if (listError) {
      console.error("Error listing images:", listError);
    }

    // 3. Also count files directly in Storage
    let storageCount = 0;
    let storageFiles: string[] = [];
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: files, error: storageError } = await supabase.storage
        .from("guess-images")
        .list("products", {
          limit: pageSize,
          offset: offset,
          sortBy: { column: "name", order: "asc" }
        });
      
      if (storageError || !files || files.length === 0) {
        hasMore = false;
        break;
      }
      
      // Only count actual files (with extensions)
      const imageFiles = files.filter(f => 
        f.name.includes('.') && 
        ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(f.name.split('.').pop()?.toLowerCase() || '')
      );
      
      storageCount += imageFiles.length;
      storageFiles.push(...imageFiles.map(f => f.name));
      
      if (files.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }
    }

    // 4. Analyze images by brand/pattern
    const stats = {
      total_in_index: indexCount || 0,
      total_in_storage: storageCount,
      by_brand: {
        GUESS: { count: 0, sample: [] as string[] },
        VILEBREQUIN: { count: 0, sample: [] as string[] },
        SAM_EDELMAN: { count: 0, sample: [] as string[] },
        DKNY: { count: 0, sample: [] as string[] },
        BAYTON: { count: 0, sample: [] as string[] },
        OTHER: { count: 0, sample: [] as string[] },
      },
      unique_model_refs: 0,
      unique_colors: 0,
    };

    // Analyze files
    const modelRefs = new Set<string>();
    const colors = new Set<string>();
    
    if (allImages) {
      for (const img of allImages) {
        modelRefs.add(img.model_ref);
        colors.add(img.color);
        
        const filename = img.filename?.toUpperCase() || img.model_ref?.toUpperCase() || '';
        const modelRef = img.model_ref?.toUpperCase() || '';
        
        // Categorize by brand based on filename patterns
        if (filename.includes('VILEBREQUIN') || modelRef.startsWith('P') && modelRef.length === 8) {
          // VILEBREQUIN typically has 8-char modelRefs starting with P
          stats.by_brand.VILEBREQUIN.count++;
          if (stats.by_brand.VILEBREQUIN.sample.length < 3) {
            stats.by_brand.VILEBREQUIN.sample.push(img.filename || modelRef);
          }
        } else if (filename.includes('SAM') || filename.includes('EDELMAN')) {
          stats.by_brand.SAM_EDELMAN.count++;
          if (stats.by_brand.SAM_EDELMAN.sample.length < 3) {
            stats.by_brand.SAM_EDELMAN.sample.push(img.filename || modelRef);
          }
        } else if (filename.includes('DKNY')) {
          stats.by_brand.DKNY.count++;
          if (stats.by_brand.DKNY.sample.length < 3) {
            stats.by_brand.DKNY.sample.push(img.filename || modelRef);
          }
        } else if (filename.includes('BAYTON')) {
          stats.by_brand.BAYTON.count++;
          if (stats.by_brand.BAYTON.sample.length < 3) {
            stats.by_brand.BAYTON.sample.push(img.filename || modelRef);
          }
        } else {
          // Default to GUESS
          stats.by_brand.GUESS.count++;
          if (stats.by_brand.GUESS.sample.length < 3) {
            stats.by_brand.GUESS.sample.push(img.filename || modelRef);
          }
        }
      }
    }

    stats.unique_model_refs = modelRefs.size;
    stats.unique_colors = colors.size;

    // 5. Get sample of first 50 files for preview
    const sampleFiles = storageFiles.slice(0, 50);

    return NextResponse.json({
      success: true,
      stats,
      sample_files: sampleFiles,
      message: `Total: ${storageCount} images dans Supabase Storage, ${indexCount || 0} dans l'index`
    });

  } catch (error) {
    console.error("Error getting image stats:", error);
    return NextResponse.json(
      { error: "Failed to get image stats", details: String(error) },
      { status: 500 }
    );
  }
}

