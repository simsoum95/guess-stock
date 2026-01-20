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
    // Try to add the column using rpc (requires the function to exist)
    // First, let's check if permissions column exists by selecting it
    const { error: testError } = await supabaseAdmin
      .from("admins")
      .select("permissions")
      .limit(1);

    if (testError && testError.message.includes("permissions")) {
      // Column doesn't exist - try to create it via SQL function
      // First, create a helper function if it doesn't exist
      const { error: rpcError } = await supabaseAdmin.rpc('add_permissions_column');
      
      if (rpcError) {
        return NextResponse.json({
          success: false,
          message: "La colonne 'permissions' n'existe pas. Exécutez ce SQL dans le SQL Editor de Supabase Dashboard:",
          sql: `-- Étape 1: Ajouter la colonne
ALTER TABLE admins ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- Étape 2: Mettre à jour les permissions par défaut pour super_admin
UPDATE admins SET permissions = '{"access_google_sheet":true,"add_products":true,"edit_products":true,"edit_images":true,"view_orders":true,"process_orders":true,"delete_orders":true,"export_orders":true,"manage_users":true}'::jsonb WHERE role = 'super_admin';

-- Étape 3: Mettre à jour les permissions par défaut pour admin
UPDATE admins SET permissions = '{"access_google_sheet":true,"add_products":true,"edit_products":true,"edit_images":true,"view_orders":true,"process_orders":true,"delete_orders":true,"export_orders":true,"manage_users":false}'::jsonb WHERE role = 'admin';

-- Étape 4: Mettre à jour les permissions par défaut pour viewer
UPDATE admins SET permissions = '{"access_google_sheet":false,"add_products":false,"edit_products":false,"edit_images":false,"view_orders":true,"process_orders":false,"delete_orders":false,"export_orders":false,"manage_users":false}'::jsonb WHERE role = 'viewer';`,
          instructions: [
            "1. Allez sur https://supabase.com/dashboard",
            "2. Sélectionnez votre projet",
            "3. Cliquez sur 'SQL Editor' dans le menu à gauche",
            "4. Collez le SQL ci-dessus",
            "5. Cliquez sur 'Run'",
            "6. Revenez ici et rafraîchissez la page"
          ]
        });
      }
    }

    // Column exists - update permissions for admins who don't have them
    const { data: admins } = await supabaseAdmin
      .from("admins")
      .select("id, email, role, permissions");

    const updates = [];
    for (const admin of admins || []) {
      // If no permissions set or empty, use defaults based on role
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

    if (updates.length > 0) {
      await Promise.all(updates);
    }

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

