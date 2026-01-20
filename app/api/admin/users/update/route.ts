import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { user_id, role, permissions } = await request.json();

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "user_id requis" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if user exists and is not super_admin
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from("admins")
      .select("role")
      .eq("user_id", user_id)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json(
        { success: false, error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    // Don't allow modifying super_admin
    if (existingUser.role === "super_admin") {
      return NextResponse.json(
        { success: false, error: "Impossible de modifier le super admin" },
        { status: 403 }
      );
    }

    // Don't allow setting role to super_admin via API
    if (role === "super_admin") {
      return NextResponse.json(
        { success: false, error: "Impossible de définir le rôle super_admin" },
        { status: 403 }
      );
    }

    // Update user
    const updateData: Record<string, unknown> = {};
    if (role) updateData.role = role;
    if (permissions) updateData.permissions = permissions;

    const { error: updateError } = await supabaseAdmin
      .from("admins")
      .update(updateData)
      .eq("user_id", user_id);

    if (updateError) {
      console.error("[API] Update error:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[API] Error updating user:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

