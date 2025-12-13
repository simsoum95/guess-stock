import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://icpedcfdavwyvkuipqiz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljcGVkY2ZkYXZ3eXZrdWlwcWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTI0ODQsImV4cCI6MjA4MDkyODQ4NH0.3Ajcv9avpVtpOCTgvDk8O3P_SnjBwxiZEwmlbm0Jihk";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // Essayer de récupérer une ligne pour voir les colonnes
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .limit(1);

  if (error) {
    console.log("Erreur:", error);
  } else {
    console.log("Données (1 row):", data);
    if (data && data.length > 0) {
      console.log("\nColonnes disponibles:", Object.keys(data[0]));
    } else {
      console.log("\nTable vide - pas de colonnes à afficher");
      
      // Essayons d'insérer une ligne test pour voir l'erreur détaillée
      console.log("\nTest d'insertion avec colonnes camelCase...");
      const { error: insertError } = await supabase
        .from("products")
        .insert({
          id: "test-123",
          collection: "TEST",
          category: "תיק",
          subcategory: "test",
          brand: "TEST",
          modelRef: "TEST-REF",
          gender: "unisex",
          supplier: "TEST",
          color: "black",
          priceRetail: 100,
          priceWholesale: 50,
          stockQuantity: 10,
          imageUrl: "/images/default.png",
          gallery: [],
          productName: "Test Product",
          size: "M"
        });
      
      if (insertError) {
        console.log("Erreur insertion camelCase:", insertError.message);
      } else {
        console.log("Insertion réussie avec camelCase!");
        // Supprimer le test
        await supabase.from("products").delete().eq("id", "test-123");
      }
    }
  }
}

main().catch(console.error);




