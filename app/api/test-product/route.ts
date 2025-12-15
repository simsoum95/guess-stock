import { NextRequest, NextResponse } from "next/server";
import { fetchProducts } from "@/lib/fetchProducts";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelRef = searchParams.get("modelRef") || "PD760221";
  
  try {
    console.log(`[test-product] Fetching all products...`);
    const allProducts = await fetchProducts();
    console.log(`[test-product] Total products: ${allProducts.length}`);
    
    // Find products matching the modelRef
    const matching = allProducts.filter(p => 
      p.modelRef?.toUpperCase().includes(modelRef.toUpperCase()) ||
      p.id?.toUpperCase().includes(modelRef.toUpperCase())
    );
    
    return NextResponse.json({
      searchedFor: modelRef,
      totalProducts: allProducts.length,
      matchingCount: matching.length,
      products: matching.map(p => ({
        id: p.id,
        modelRef: p.modelRef,
        color: p.color,
        colorCode: (p as any).colorCode || "N/A",
        category: p.category,
        imageUrl: p.imageUrl,
        galleryCount: p.gallery?.length || 0,
        hasImage: p.imageUrl && !p.imageUrl.includes("default")
      }))
    });
  } catch (error: any) {
    console.error("[test-product] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

