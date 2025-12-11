import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { historyId } = await request.json();

    if (!historyId) {
      return NextResponse.json({ success: false, error: "חסר מזהה היסטוריה" }, { status: 400 });
    }

    // Récupérer l'entrée d'historique
    const { data: history, error: fetchErr } = await supabase
      .from("upload_history")
      .select("*")
      .eq("id", historyId)
      .single();

    if (fetchErr || !history) {
      return NextResponse.json({ success: false, error: "היסטוריה לא נמצאה" }, { status: 404 });
    }

    const snapshot = history.snapshot_before;
    if (!snapshot || !Array.isArray(snapshot)) {
      return NextResponse.json({ success: false, error: "אין נתונים לשחזור" }, { status: 400 });
    }

    console.log(`[Restore] Restoring ${snapshot.length} products from history ${historyId}`);

    let restored = 0;
    let errors = 0;

    // Restaurer chaque produit
    for (const product of snapshot) {
      const { error: updateErr } = await supabase
        .from("products")
        .update({
          stockQuantity: product.stockQuantity,
          priceRetail: product.priceRetail,
          priceWholesale: product.priceWholesale,
          productName: product.productName,
        })
        .eq("id", product.id);

      if (updateErr) {
        console.error(`[Restore] Error restoring ${product.modelRef}:`, updateErr);
        errors++;
      } else {
        restored++;
      }
    }

    // Marquer l'historique comme restauré
    await supabase
      .from("upload_history")
      .update({ restored_at: new Date().toISOString() })
      .eq("id", historyId);

    console.log(`[Restore] Completed: ${restored} restored, ${errors} errors`);

    return NextResponse.json({
      success: true,
      restored,
      errors,
      message: `שוחזרו ${restored} מוצרים`,
    });

  } catch (err: any) {
    console.error("[Restore] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

