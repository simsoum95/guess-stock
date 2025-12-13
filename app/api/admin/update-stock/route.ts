import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const authCookie = request.cookies.get("sb-auth-token");
    if (!authCookie?.value) {
      return NextResponse.json(
        { success: false, error: "לא מורשה" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { productId, stockQuantity, modelRef, color } = body;

    if (stockQuantity === undefined || stockQuantity === null) {
      return NextResponse.json(
        { success: false, error: "נתונים חסרים" },
        { status: 400 }
      );
    }

    if (stockQuantity < 0) {
      return NextResponse.json(
        { success: false, error: "מלאי לא יכול להיות שלילי" },
        { status: 400 }
      );
    }

    // Récupérer le produit actuel pour obtenir l'ancien stock
    let query = supabase.from("products").select("id, stockQuantity");
    
    if (productId && productId !== "GUESS") {
      query = query.eq("id", productId);
    } else if (modelRef && color) {
      query = query.eq("modelRef", modelRef).eq("color", color);
    } else {
      return NextResponse.json(
        { success: false, error: "מזהה מוצר או modelRef+color חסר" },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchError } = await query.single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: "מוצר לא נמצא" },
        { status: 404 }
      );
    }

    const oldStock = existing.stockQuantity || 0;

    // Mettre à jour le stock dans Supabase
    let updateQuery = supabase
      .from("products")
      .update({ stockQuantity })
      .eq("id", existing.id);

    const { error: updateError } = await updateQuery;

    if (updateError) {
      console.error("Update stock error:", updateError);
      return NextResponse.json(
        { success: false, error: `שגיאה בעדכון המלאי: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `מלאי עודכן: ${oldStock} → ${stockQuantity}`,
      product: {
        id: existing.id,
        oldStock,
        newStock: stockQuantity,
      },
    });
  } catch (error: any) {
    console.error("Update stock error:", error);
    return NextResponse.json(
      { success: false, error: `שגיאה בעדכון המלאי: ${error.message}` },
      { status: 500 }
    );
  }
}







