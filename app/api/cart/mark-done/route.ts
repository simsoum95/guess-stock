import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "Missing orderId" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("cart_exports")
      .update({ status: "done", viewed: true })
      .eq("id", orderId);

    if (error) {
      console.error("[cart/mark-done] Error updating order:", error);
      return NextResponse.json(
        { error: "Failed to mark as done" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[cart/mark-done] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

