/**
 * Sync products from Google Sheet to Supabase
 * - Creates new products from Sheet
 * - Updates existing products from Sheet
 * - Marks products NOT in Sheet with stock = 0 (but keeps them in DB)
 */

import { supabase } from "./supabase";
import { fetchProductsFromGoogleSheet, mapSheetRowToProduct } from "./fetchGoogleSheet";
import type { Product } from "./types";

interface SupabaseProduct {
  id?: string;
  model_ref: string;
  color: string;
  item_code?: string;
  collection?: string;
  subcategory?: string;
  category?: string;
  brand?: string;
  gender?: string;
  supplier?: string;
  product_name?: string;
  size?: string;
  price_retail: number;
  price_wholesale: number;
  stock_quantity: number;
  image_url?: string;
  gallery?: string[];
  color_code?: string;
}

/**
 * Convert Product to Supabase format
 */
function productToSupabase(product: Product): SupabaseProduct {
  return {
    model_ref: product.modelRef,
    color: product.color,
    item_code: (product as any).itemCode,
    collection: product.collection,
    subcategory: product.subcategory,
    category: product.category,
    brand: product.brand,
    gender: product.gender,
    supplier: product.supplier,
    product_name: product.productName,
    size: product.size,
    price_retail: product.priceRetail,
    price_wholesale: product.priceWholesale,
    stock_quantity: product.stockQuantity,
    image_url: product.imageUrl,
    gallery: product.gallery || [],
    color_code: (product as any).colorCode,
  };
}

/**
 * Sync products from Google Sheet to Supabase
 * Returns stats about the sync operation
 */
export async function syncProductsFromGoogleSheet(): Promise<{
  success: boolean;
  stats: {
    sheetProducts: number;
    created: number;
    updated: number;
    zeroed: number;
    errors: number;
  };
  error?: string;
}> {
  try {
    console.log("[syncProductsFromGoogleSheet] Starting sync...");

    // Step 1: Fetch products from Google Sheet
    const sheetRows = await fetchProductsFromGoogleSheet();
    console.log(`[syncProductsFromGoogleSheet] Fetched ${sheetRows.length} rows from Google Sheet`);

    // Step 2: Convert to Product format and get unique keys (modelRef + color)
    const sheetProducts = sheetRows.map(row => {
      try {
        return mapSheetRowToProduct(row);
      } catch (error) {
        console.error(`[syncProductsFromGoogleSheet] Error mapping row:`, error);
        return null;
      }
    }).filter((p): p is Product => p !== null);

    console.log(`[syncProductsFromGoogleSheet] Mapped ${sheetProducts.length} products from Sheet`);

    // Step 3: Get all existing products from Supabase
    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('*');

    if (fetchError) {
      throw new Error(`Failed to fetch existing products: ${fetchError.message}`);
    }

    console.log(`[syncProductsFromGoogleSheet] Found ${existingProducts?.length || 0} existing products in Supabase`);

    // Step 4: Create a map of products from Sheet by (modelRef, color)
    const sheetProductsMap = new Map<string, Product>();
    for (const product of sheetProducts) {
      const key = `${product.modelRef}|${product.color}`;
      sheetProductsMap.set(key, product);
    }

    // Step 5: Create a map of existing products by (modelRef, color)
    const existingProductsMap = new Map<string, any>();
    for (const product of existingProducts || []) {
      const key = `${product.model_ref}|${product.color}`;
      existingProductsMap.set(key, product);
    }

    // Step 6: Process each product from Sheet (create or update)
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const product of sheetProducts) {
      const key = `${product.modelRef}|${product.color}`;
      const existing = existingProductsMap.get(key);
      const supabaseProduct = productToSupabase(product);
      supabaseProduct.last_synced_at = new Date().toISOString();

      try {
        if (existing) {
          // Update existing product
          const { error: updateError } = await supabase
            .from('products')
            .update(supabaseProduct)
            .eq('model_ref', product.modelRef)
            .eq('color', product.color);

          if (updateError) {
            console.error(`[syncProductsFromGoogleSheet] Error updating product ${key}:`, updateError);
            errors++;
          } else {
            updated++;
          }
        } else {
          // Create new product
          const { error: insertError } = await supabase
            .from('products')
            .insert(supabaseProduct);

          if (insertError) {
            console.error(`[syncProductsFromGoogleSheet] Error creating product ${key}:`, insertError);
            errors++;
          } else {
            created++;
          }
        }
      } catch (error: any) {
        console.error(`[syncProductsFromGoogleSheet] Exception processing product ${key}:`, error);
        errors++;
      }
    }

    // Step 7: Mark products NOT in Sheet with stock = 0 (but keep them in DB)
    let zeroed = 0;
    for (const [key, existingProduct] of existingProductsMap.entries()) {
      if (!sheetProductsMap.has(key)) {
        // Product exists in DB but not in Sheet - set stock to 0
        if (existingProduct.stock_quantity !== 0) {
          const { error: zeroError } = await supabase
            .from('products')
            .update({ 
              stock_quantity: 0,
              last_synced_at: new Date().toISOString()
            })
            .eq('model_ref', existingProduct.model_ref)
            .eq('color', existingProduct.color);

          if (zeroError) {
            console.error(`[syncProductsFromGoogleSheet] Error zeroing stock for ${key}:`, zeroError);
            errors++;
          } else {
            zeroed++;
          }
        }
      }
    }

    console.log(`[syncProductsFromGoogleSheet] Sync complete: ${created} created, ${updated} updated, ${zeroed} zeroed, ${errors} errors`);

    return {
      success: true,
      stats: {
        sheetProducts: sheetProducts.length,
        created,
        updated,
        zeroed,
        errors,
      },
    };
  } catch (error: any) {
    console.error("[syncProductsFromGoogleSheet] Fatal error:", error);
    return {
      success: false,
      error: error.message,
      stats: {
        sheetProducts: 0,
        created: 0,
        updated: 0,
        zeroed: 0,
        errors: 0,
      },
    };
  }
}

