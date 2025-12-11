import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function createHistoryTable() {
  console.log("🔧 Creating upload_history table via Supabase API...");
  console.log("URL:", SUPABASE_URL);

  // Extraire le project ref de l'URL
  const projectRef = SUPABASE_URL.replace("https://", "").split(".")[0];
  console.log("Project ref:", projectRef);

  const sql = `
    CREATE TABLE IF NOT EXISTS upload_history (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      file_name TEXT NOT NULL,
      uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      stats JSONB NOT NULL DEFAULT '{}',
      changes JSONB DEFAULT '[]',
      inserted_products JSONB DEFAULT '[]',
      zeroed_products JSONB DEFAULT '[]',
      snapshot_before JSONB DEFAULT '[]',
      sync_stock_enabled BOOLEAN DEFAULT FALSE,
      restored_at TIMESTAMP WITH TIME ZONE
    );
    ALTER TABLE upload_history DISABLE ROW LEVEL SECURITY;
  `;

  // Utiliser l'API REST de Supabase pour exécuter SQL
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    // L'API RPC n'existe probablement pas, essayons via postgREST
    console.log("⚠️ RPC method not available");
    
    // Créer via l'interface SQL de Supabase Management API
    const mgmtResponse = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (!mgmtResponse.ok) {
      console.log("\n❌ Cannot create table automatically via API.");
      console.log("\n📋 Please copy and paste this SQL in Supabase Dashboard > SQL Editor:\n");
      console.log("=".repeat(60));
      console.log(`
CREATE TABLE IF NOT EXISTS upload_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stats JSONB NOT NULL DEFAULT '{}',
  changes JSONB DEFAULT '[]',
  inserted_products JSONB DEFAULT '[]',
  zeroed_products JSONB DEFAULT '[]',
  snapshot_before JSONB DEFAULT '[]',
  sync_stock_enabled BOOLEAN DEFAULT FALSE,
  restored_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE upload_history DISABLE ROW LEVEL SECURITY;
      `);
      console.log("=".repeat(60));
      console.log("\n🔗 Go to: https://supabase.com/dashboard/project/" + projectRef + "/sql/new");
      return;
    }

    const mgmtData = await mgmtResponse.json();
    console.log("✅ Table created via Management API:", mgmtData);
  } else {
    console.log("✅ Table created successfully!");
  }

  // Vérifier que la table existe
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase.from("upload_history").select("id").limit(1);
  
  if (error) {
    console.log("❌ Verification failed:", error.message);
  } else {
    console.log("✅ Table verified and ready!");
  }
}

createHistoryTable().catch(console.error);
