import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shopName, firstName, phone, items, totalPrice } = body;

    if (!shopName || !firstName || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get IP address (if available)
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     null;

    // Insert into Supabase
    const { data, error } = await supabase
      .from("cart_exports")
      .insert({
        shop_name: shopName,
        first_name: firstName,
        phone: phone || null,
        items: items,
        total_price: totalPrice,
        ip_address: ipAddress,
        viewed: false, // New orders are unread by default
        status: "pending", // New orders are pending by default
      })
      .select()
      .single();

    if (error) {
      console.error("[cart/export] Error inserting cart export:", error);
      return NextResponse.json(
        { error: "Failed to save cart export" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("[cart/export] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

