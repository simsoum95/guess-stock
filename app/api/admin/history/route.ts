import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("upload_history")
      .select("id, file_name, uploaded_at, stats, changes, inserted_products, zeroed_products, sync_stock_enabled, restored_at")
      .order("uploaded_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("[History] Error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, history: data || [] });

  } catch (err: any) {
    console.error("[History] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

