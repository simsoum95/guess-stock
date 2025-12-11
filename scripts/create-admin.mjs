/**
 * Script to create an admin user
 * Usage: node scripts/create-admin.mjs email@example.com password123 "Admin Name"
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://icpedcfdavwyvkuipqiz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is required");
  console.log("\nSet it in .env.upload or pass as environment variable");
  process.exit(1);
}

const [email, password, name] = process.argv.slice(2);

if (!email || !password) {
  console.log("Usage: node scripts/create-admin.mjs email password [name]");
  console.log("Example: node scripts/create-admin.mjs admin@example.com SecurePass123 'Admin User'");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createAdmin() {
  console.log("\n🔧 Creating admin user...\n");

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    console.error("❌ Auth error:", authError.message);
    process.exit(1);
  }

  console.log("✅ Auth user created:", authData.user.id);

  // 2. Add to admins table
  const { error: adminError } = await supabase
    .from("admins")
    .insert({
      user_id: authData.user.id,
      email,
      name: name || email.split("@")[0],
      role: "admin",
    });

  if (adminError) {
    console.error("❌ Admin table error:", adminError.message);
    // Rollback
    await supabase.auth.admin.deleteUser(authData.user.id);
    process.exit(1);
  }

  console.log("✅ Admin record created");
  console.log("\n" + "=".repeat(50));
  console.log("🎉 Admin user created successfully!");
  console.log("=".repeat(50));
  console.log(`\nEmail: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Name: ${name || email.split("@")[0]}`);
  console.log("\nYou can now login at /admin/login");
}

createAdmin().catch(console.error);




