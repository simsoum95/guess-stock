import { NextRequest, NextResponse } from "next/server";
import { updateProductInGoogleSheet } from "@/lib/updateGoogleSheet";
import { createClient } from "@supabase/supabase-js";

/**
 * API route to update product in Google Sheets (data) and Supabase (images)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelRef, color, ...updateData } = body;

    if (!modelRef || !color) {
      return NextResponse.json(
        { error: "modelRef and color are required" },
        { status: 400 }
      );
    }

    // Update Google Sheets (product data, stock, prices)
    const googleSheetResult = await updateProductInGoogleSheet({
      modelRef,
      color,
      ...updateData,
    });

    if (!googleSheetResult.success) {
      return NextResponse.json(
        { error: googleSheetResult.error || "Failed to update Google Sheet" },
        { status: 500 }
      );
    }

    // Update Supabase (images only)
    if (updateData.imageUrl || updateData.gallery) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error: supabaseError } = await supabase
        .from("products")
        .update({
          imageUrl: updateData.imageUrl,
          gallery: updateData.gallery,
        })
        .eq("modelRef", modelRef)
        .eq("color", color);

      if (supabaseError) {
        console.error("Supabase update error:", supabaseError);
        // Don't fail the whole request if image update fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
