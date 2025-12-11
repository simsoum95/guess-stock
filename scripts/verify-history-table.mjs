import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log("🔍 Verifying upload_history table...");
  
  const { data, error } = await supabase
    .from("upload_history")
    .select("*")
    .limit(1);
  
  if (error) {
    console.log("❌ Error:", error.message);
  } else {
    console.log("✅ Table exists and is accessible!");
    console.log("📊 Current entries:", data.length);
  }
}

verify();

