import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Variables d'environnement manquantes!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixAbnormalValues() {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("🔧 CORRECTION DES VALEURS ABERRANTES");
  console.log("=".repeat(60));
  console.log();

  try {
    // Charger tous les produits
    const { data: products, error } = await supabase
      .from("products")
      .select("id, modelRef, color, stockQuantity, priceWholesale, priceRetail");

    if (error) {
      console.error("❌ Erreur:", error.message);
      return;
    }

    console.log(`📊 Analyse de ${products?.length || 0} produits`);
    console.log();

    const fixes = [];
    let fixedCount = 0;

    for (const p of products || []) {
      const updates = {};
      let needsFix = false;

      // Vérifier et corriger le stock
      const stock = Number(p.stockQuantity);
      if (isNaN(stock) || !isFinite(stock) || stock < 0) {
        updates.stockQuantity = 0;
        needsFix = true;
        console.log(`⚠️  ${p.modelRef} / ${p.color}: Stock invalide "${p.stockQuantity}" → 0`);
      } else if (stock > 10000) {
        console.log(`⚠️  ${p.modelRef} / ${p.color}: Stock suspect ${stock} (>10000) - NON CORRIGÉ`);
        // On ne corrige pas automatiquement les stocks > 10000, juste on les signale
      }

      // Vérifier et corriger le prix wholesale
      const priceWholesale = Number(p.priceWholesale);
      if (isNaN(priceWholesale) || !isFinite(priceWholesale) || priceWholesale < 0) {
        updates.priceWholesale = 0;
        needsFix = true;
        console.log(`⚠️  ${p.modelRef} / ${p.color}: Prix wholesale invalide "${p.priceWholesale}" → 0`);
      } else if (priceWholesale > 100000) {
        console.log(`⚠️  ${p.modelRef} / ${p.color}: Prix wholesale suspect ${priceWholesale} (>100000) - NON CORRIGÉ`);
      }

      // Vérifier et corriger le prix retail
      const priceRetail = Number(p.priceRetail);
      if (isNaN(priceRetail) || !isFinite(priceRetail) || priceRetail < 0) {
        updates.priceRetail = 0;
        needsFix = true;
        console.log(`⚠️  ${p.modelRef} / ${p.color}: Prix retail invalide "${p.priceRetail}" → 0`);
      } else if (priceRetail > 100000) {
        console.log(`⚠️  ${p.modelRef} / ${p.color}: Prix retail suspect ${priceRetail} (>100000) - NON CORRIGÉ`);
      }

      if (needsFix) {
        fixes.push({ id: p.id, updates });
      }
    }

    console.log();
    console.log(`📋 ${fixes.length} produits nécessitent une correction`);
    console.log();

    if (fixes.length === 0) {
      console.log("✅ Aucune correction nécessaire!");
      return;
    }

    // Appliquer les corrections
    for (const fix of fixes) {
      const { error: updateError } = await supabase
        .from("products")
        .update(fix.updates)
        .eq("id", fix.id);

      if (updateError) {
        console.error(`❌ Erreur lors de la correction de ${fix.id}:`, updateError.message);
      } else {
        fixedCount++;
      }
    }

    console.log();
    console.log("=".repeat(60));
    console.log(`✅ ${fixedCount} produits corrigés`);
    console.log("=".repeat(60));
    console.log();

  } catch (error) {
    console.error("❌ Erreur fatale:", error);
  }
}

fixAbnormalValues().catch(console.error);



