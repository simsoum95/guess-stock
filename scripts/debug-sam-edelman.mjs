/**
 * Debug script to check SAM EDELMAN products and images
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchProductsFromGoogleSheet, mapSheetRowToProduct } from '../lib/fetchGoogleSheet.js';

// Load environment variables
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function main() {
    console.log("🔍 Debug: SAM EDELMAN products and images\n");

    // 1. Fetch SAM EDELMAN products from Google Sheet
    console.log("1. Fetching products from Google Sheet...");
    const allRows = await fetchProductsFromGoogleSheet();
    const samRows = allRows.filter(row => {
        const sheetName = row._sheetName || '';
        return sheetName.includes('SAM') || sheetName.includes('נעליים SAM');
    });

    console.log(`   Found ${samRows.length} SAM EDELMAN rows\n`);

    // 2. Map to products (take first 5 as examples)
    console.log("2. First 5 products:");
    const products = samRows.slice(0, 5).map((row, idx) => {
        return mapSheetRowToProduct(row, idx, row._sheetName);
    });

    products.forEach((p, idx) => {
        console.log(`\n   Product ${idx + 1}:`);
        console.log(`     modelRef: "${p.modelRef}"`);
        console.log(`     color: "${p.color}"`);
        console.log(`     colorCode: "${p.colorCode}"`);
        console.log(`     itemCode: "${p.itemCode}"`);
    });

    // 3. Check images in database for these products
    console.log("\n3. Checking images in database:");
    for (const product of products) {
        const modelRef = product.modelRef.toUpperCase().trim();
        const color = product.color.toUpperCase().trim();
        const colorCode = product.colorCode.toUpperCase().trim();

        console.log(`\n   Product: ${modelRef} | color: ${color} | colorCode: ${colorCode}`);

        // Try exact match with modelRef|color
        const key1 = `${modelRef}|${color}`;
        const { data: img1 } = await supabase
            .from('image_index')
            .select('model_ref, color, filename')
            .eq('model_ref', modelRef)
            .eq('color', color)
            .limit(5);

        if (img1 && img1.length > 0) {
            console.log(`   ✅ Found ${img1.length} images with exact match (modelRef|color)`);
            img1.forEach(img => console.log(`      - ${img.filename} (color: ${img.color})`));
        } else {
            console.log(`   ❌ No images found with exact match (modelRef|color)`);
        }

        // Try with colorCode if different
        if (colorCode && colorCode !== color) {
            const { data: img2 } = await supabase
                .from('image_index')
                .select('model_ref, color, filename')
                .eq('model_ref', modelRef)
                .eq('color', colorCode)
                .limit(5);

            if (img2 && img2.length > 0) {
                console.log(`   ✅ Found ${img2.length} images with colorCode match`);
                img2.forEach(img => console.log(`      - ${img.filename} (color: ${img.color})`));
            } else {
                console.log(`   ❌ No images found with colorCode match`);
            }
        }

        // Try to find any images with this modelRef
        const { data: img3 } = await supabase
            .from('image_index')
            .select('model_ref, color, filename')
            .eq('model_ref', modelRef)
            .limit(10);

        if (img3 && img3.length > 0) {
            console.log(`   📋 Found ${img3.length} total images for this modelRef:`);
            const uniqueColors = [...new Set(img3.map(img => img.color))];
            uniqueColors.forEach(c => {
                const count = img3.filter(img => img.color === c).length;
                console.log(`      - Color "${c}": ${count} images`);
            });
        } else {
            console.log(`   ❌ No images found for this modelRef at all`);
        }
    }
}

main().catch(console.error);

