import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Move to trash (change status to "deleted")
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("cart_exports")
      .update({ status: "deleted" })
      .eq("id", orderId);

    if (error) {
      console.error("Error moving to trash:", error);
      return NextResponse.json(
        { error: "Failed to move to trash" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in delete route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Permanently delete
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("cart_exports")
      .delete()
      .eq("id", orderId);

    if (error) {
      console.error("Error deleting order:", error);
      return NextResponse.json(
        { error: "Failed to delete order" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in delete route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Restore from trash
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("cart_exports")
      .update({ status: "pending" })
      .eq("id", orderId);

    if (error) {
      console.error("Error restoring order:", error);
      return NextResponse.json(
        { error: "Failed to restore order" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in restore route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

