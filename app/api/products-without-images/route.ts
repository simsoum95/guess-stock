import { NextResponse } from "next/server";
import { fetchProducts } from "@/lib/fetchProducts";

export const dynamic = 'force-dynamic';

/**
 * GET /api/products-without-images
 * Returns a list of products that don't have images
 */
export async function GET() {
  try {
    const products = await fetchProducts();
    
    // Filter products without images (default image or empty)
    const productsWithoutImages = products.filter(p => {
      const hasNoImage = !p.imageUrl || 
                         p.imageUrl === "/images/default.png" ||
                         p.imageUrl.includes("default");
      return hasNoImage;
    });

    // Sort by modelRef for easier reading
    productsWithoutImages.sort((a, b) => a.modelRef.localeCompare(b.modelRef));

    // Create summary
    const summary = {
      totalProducts: products.length,
      productsWithImages: products.length - productsWithoutImages.length,
      productsWithoutImages: productsWithoutImages.length,
      percentage: Math.round((productsWithoutImages.length / products.length) * 100) + "%"
    };

    // List of products without images (modelRef + color)
    const list = productsWithoutImages.map(p => ({
      modelRef: p.modelRef,
      color: p.color,
      subcategory: p.subcategory,
      brand: p.brand
    }));

    return NextResponse.json({
      success: true,
      summary,
      products: list
    });

  } catch (error) {
    console.error("[API] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

