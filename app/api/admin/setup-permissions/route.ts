import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Default permissions for each role
const DEFAULT_PERMISSIONS = {
  super_admin: {
    access_google_sheet: true,
    add_products: true,
    edit_products: true,
    edit_images: true,
    view_orders: true,
    process_orders: true,
    delete_orders: true,
    export_orders: true,
    manage_users: true,
  },
  admin: {
    access_google_sheet: true,
    add_products: true,
    edit_products: true,
    edit_images: true,
    view_orders: true,
    process_orders: true,
    delete_orders: true,
    export_orders: true,
    manage_users: false,
  },
  viewer: {
    access_google_sheet: false,
    add_products: false,
    edit_products: false,
    edit_images: false,
    view_orders: true,
    process_orders: false,
    delete_orders: false,
    export_orders: false,
    manage_users: false,
  },
};

export async function GET() {
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

  try {
    // Check if permissions column exists
    const { data: testData, error: testError } = await supabaseAdmin
      .from("admins")
      .select("permissions")
      .limit(1);

    if (testError && testError.message.includes("permissions")) {
      return NextResponse.json({
        success: false,
        message: "La colonne 'permissions' n'existe pas. Exécutez ce SQL dans Supabase:",
        sql: `ALTER TABLE admins ADD COLUMN permissions JSONB DEFAULT '{}';`
      });
    }

    // Update all admins with default permissions based on their role
    const { data: admins } = await supabaseAdmin
      .from("admins")
      .select("id, email, role, permissions");

    const updates = [];
    for (const admin of admins || []) {
      // If no permissions set, use defaults based on role
      if (!admin.permissions || Object.keys(admin.permissions).length === 0) {
        const roleKey = admin.role as keyof typeof DEFAULT_PERMISSIONS;
        const defaultPerms = DEFAULT_PERMISSIONS[roleKey] || DEFAULT_PERMISSIONS.viewer;
        
        updates.push(
          supabaseAdmin
            .from("admins")
            .update({ permissions: defaultPerms })
            .eq("id", admin.id)
        );
      }
    }

    await Promise.all(updates);

    // Get updated admins
    const { data: updatedAdmins } = await supabaseAdmin
      .from("admins")
      .select("email, role, permissions")
      .order("created_at", { ascending: true });

    return NextResponse.json({
      success: true,
      message: "Permissions configurées avec succès",
      admins: updatedAdmins
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

