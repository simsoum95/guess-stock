import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://icpedcfdavwyvkuipqiz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljcGVkY2ZkYXZ3eXZrdWlwcWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTI0ODQsImV4cCI6MjA4MDkyODQ4NH0.3Ajcv9avpVtpOCTgvDk8O3P_SnjBwxiZEwmlbm0Jihk";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTable(tableName) {
  console.log(`\n📋 Checking table: ${tableName}`);
  const { data, error, count } = await supabase
    .from(tableName)
    .select("*", { count: "exact" })
    .limit(2);

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return;
  }

  console.log(`   ✅ Count: ${data?.length || 0} rows (showing first 2)`);
  if (data && data.length > 0) {
    console.log(`   📊 Columns:`, Object.keys(data[0]));
    console.log(`   📝 Sample:`, JSON.stringify(data[0], null, 2));
  }
}

async function main() {
  console.log("🔍 Checking Supabase tables...\n");
  
  // Try common table names
  const tables = ["products", "bigud", "tikim", "shoes", "bigud.csv", "tikim.csv", "shoes.csv"];
  
  for (const table of tables) {
    await checkTable(table);
  }
}

main().catch(console.error);




