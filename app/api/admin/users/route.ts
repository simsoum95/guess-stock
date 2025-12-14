import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

// Create admin client lazily to avoid build errors
function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY n'est pas configuré. Ajoutez-le dans Vercel → Settings → Environment Variables");
  }
  
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * POST /api/admin/users - Create a new admin user
 * Creates user in Supabase Auth AND adds to admins table
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email et mot de passe requis" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Le mot de passe doit avoir au moins 6 caractères" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      console.error("[API] Auth error:", authError);
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { success: false, error: "Échec de création de l'utilisateur" },
        { status: 500 }
      );
    }

    // 2. Add user to admins table
    const { error: adminError } = await supabaseAdmin
      .from("admins")
      .insert({
        user_id: authData.user.id,
        email: email,
      });

    if (adminError) {
      console.error("[API] Admin table error:", adminError);
      // Try to clean up: delete the auth user if admin insert failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { success: false, error: `Erreur table admins: ${adminError.message}` },
        { status: 500 }
      );
    }

    console.log(`[API] Admin created successfully: ${email}`);
    return NextResponse.json({ 
      success: true, 
      user_id: authData.user.id,
      email 
    });

  } catch (error) {
    console.error("[API] Error creating admin:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users - Delete an admin user
 * Removes from admins table AND deletes from Supabase Auth
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "user_id requis" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Delete from admins table
    const { error: adminError } = await supabaseAdmin
      .from("admins")
      .delete()
      .eq("user_id", userId);

    if (adminError) {
      console.error("[API] Error deleting from admins:", adminError);
      return NextResponse.json(
        { success: false, error: adminError.message },
        { status: 500 }
      );
    }

    // 2. Delete from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("[API] Error deleting auth user:", authError);
      // Don't fail - admin table entry is already deleted
    }

    console.log(`[API] Admin deleted: ${userId}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[API] Error deleting admin:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/users - List all admins
 */
export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("admins")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, admins: data });

  } catch (error) {
    console.error("[API] Error listing admins:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

