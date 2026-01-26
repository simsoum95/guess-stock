import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export const revalidate = 30; // Revalidate every 30 seconds

export async function GET() {
  try {
    const { count, error } = await supabaseServer
      .from("cart_exports")
      .select("*", { count: "exact", head: true })
      .eq("viewed", false);

    if (error) {
      console.error("[cart/unread-count] Error counting unread:", error);
      return NextResponse.json(
        { error: "Failed to count unread requests", count: 0 },
        { status: 500 }
      );
    }

    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error("[cart/unread-count] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", count: 0 },
      { status: 500 }
    );
  }
}

