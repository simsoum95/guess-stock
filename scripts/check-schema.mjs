import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://icpedcfdavwyvkuipqiz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljcGVkY2ZkYXZ3eXZrdWlwcWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTI0ODQsImV4cCI6MjA4MDkyODQ4NH0.3Ajcv9avpVtpOCTgvDk8O3P_SnjBwxiZEwmlbm0Jihk";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("Testing insert with camelCase columns...");
  
  const testProduct = {
    id: "TEST-001",
    collection: "TEST",
    category: "bag",
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
  };

  console.log("Trying camelCase:", Object.keys(testProduct));
  const { data: data1, error: error1 } = await supabase
    .from("products")
    .insert(testProduct)
    .select();
  
  if (error1) {
    console.log("camelCase error:", error1.message);
  } else {
    console.log("camelCase SUCCESS:", data1);
    // Clean up
    await supabase.from("products").delete().eq("id", "TEST-001");
  }
}

main().catch(console.error);





