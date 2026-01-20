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

  try {
    // First, check if role column exists by trying to select it
    const { data: testData, error: testError } = await supabaseAdmin
      .from("admins")
      .select("role")
      .limit(1);

    if (testError && testError.message.includes("role")) {
      // Column doesn't exist, need to add it via raw SQL
      // Using rpc to execute SQL
      return NextResponse.json({
        success: false,
        message: "La colonne 'role' n'existe pas. Exécutez ce SQL dans Supabase Dashboard:",
        sql: `
ALTER TABLE admins ADD COLUMN role VARCHAR(50) DEFAULT 'admin' NOT NULL;

-- Définir le premier admin comme super_admin
UPDATE admins 
SET role = 'super_admin' 
WHERE id = (SELECT id FROM admins ORDER BY created_at ASC LIMIT 1);
        `.trim()
      });
    }

    // Column exists, get current admins
    const { data: admins, error: adminsError } = await supabaseAdmin
      .from("admins")
      .select("id, email, role, created_at")
      .order("created_at", { ascending: true });

    if (adminsError) {
      return NextResponse.json({ success: false, error: adminsError.message });
    }

    return NextResponse.json({
      success: true,
      message: "La colonne 'role' existe déjà",
      admins: admins
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

