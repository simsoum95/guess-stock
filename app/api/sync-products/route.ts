import { NextResponse } from "next/server";
import { syncProductsFromGoogleSheet } from "@/lib/syncProductsFromGoogleSheet";

export const dynamic = 'force-dynamic';

/**
 * POST /api/sync-products
 * Sync products from Google Sheet to Supabase
 * This can be called manually or scheduled
 */
export async function POST() {
  try {
    const result = await syncProductsFromGoogleSheet();
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, stats: result.stats },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Products synced successfully",
      stats: result.stats,
    });
  } catch (error: any) {
    console.error("[API/sync-products] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

