import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const email = "shimonhaliwa@gmail.com";
  const password = "Shimonhalili95";

  try {
    // Check if user exists in Auth
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = users?.users?.find(u => u.email === email);

    let userId: string;

    if (existingAuthUser) {
      // User exists in Auth, update password
      userId = existingAuthUser.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      console.log("Updated existing auth user password");
    } else {
      // Create new user in Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
      userId = authData.user!.id;
      console.log("Created new auth user");
    }

    // Check if exists in admins table
    const { data: existingAdmin } = await supabaseAdmin
      .from("admins")
      .select("*")
      .eq("email", email)
      .single();

    if (existingAdmin) {
      // Update to super_admin with full permissions
      await supabaseAdmin
        .from("admins")
        .update({ 
          role: "super_admin",
          user_id: userId,
          permissions: {
            access_google_sheet: true,
            add_products: true,
            edit_products: true,
            edit_images: true,
            view_orders: true,
            process_orders: true,
            delete_orders: true,
            export_orders: true,
            manage_users: true,
          }
        })
        .eq("email", email);
      
      return NextResponse.json({ 
        success: true, 
        message: "Super admin updated!",
        email,
        password
      });
    }

    // Insert new admin
    const { error: insertError } = await supabaseAdmin
      .from("admins")
      .insert({
        user_id: userId,
        email,
        role: "super_admin",
        permissions: {
          access_google_sheet: true,
          add_products: true,
          edit_products: true,
          edit_images: true,
          view_orders: true,
          process_orders: true,
          delete_orders: true,
          export_orders: true,
          manage_users: true,
        }
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Super admin created!",
      email,
      password
    });

  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

