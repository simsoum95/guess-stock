import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  
  if (email !== "shimonhaliwa@gmail.com") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
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

  try {
    // Check if user already exists in admins table
    const { data: existingAdmin } = await supabaseAdmin
      .from("admins")
      .select("*")
      .eq("email", email)
      .single();

    if (existingAdmin) {
      // Update to super_admin
      await supabaseAdmin
        .from("admins")
        .update({ role: "super_admin" })
        .eq("email", email);
      
      return NextResponse.json({ 
        success: true, 
        message: "Rôle mis à jour vers super_admin" 
      });
    }

    // Create new user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // Add to admins table as super_admin
    const { error: insertError } = await supabaseAdmin
      .from("admins")
      .insert({
        user_id: authData.user!.id,
        email: email,
        role: "super_admin",
      });

    if (insertError) {
      // Cleanup auth user if insert failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user!.id);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Super admin créé avec succès!" 
    });

  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

