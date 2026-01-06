/**
 * Debug script to check why SAM EDELMAN images don't match products
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
    console.log("🔍 Debug: SAM EDELMAN matching\n");

    // 1. Check images in database
    console.log("1. Images SAM EDELMAN dans la base de données:");
    const { data: images } = await supabase
        .from('image_index')
        .select('model_ref, color, filename')
        .ilike('model_ref', 'HBSE%')
        .limit(20);

    if (images && images.length > 0) {
        console.log(`   Trouvé ${images.length} images\n`);
        
        // Group by modelRef and color
        const grouped = new Map();
        images.forEach(img => {
            const key = `${img.model_ref}|${img.color}`;
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key).push(img.filename);
        });

        console.log("   Exemples d'images indexées:");
        let count = 0;
        for (const [key, filenames] of grouped.entries()) {
            if (count >= 5) break;
            const [modelRef, color] = key.split('|');
            console.log(`     modelRef: "${modelRef}", color: "${color}"`);
            console.log(`       Images: ${filenames.slice(0, 3).join(', ')}... (${filenames.length} total)\n`);
            count++;
        }
    }

    // 2. Simulate what products would look like from Google Sheet
    // For SAM EDELMAN, itemCode might be like "HBSE-125-0011-BLACK-OS"
    // modelRef would be extracted as: first part before dash = "HBSE-125-0011" (WRONG - should split correctly)
    console.log("2. Simulation: Comment les produits sont parsés depuis Google Sheet\n");
    
    const testItemCodes = [
        "HBSE-125-0011-BLACK-OS",
        "HBSE-125-0011-TAUPE-OS",
        "HBSE-125-0013-BLACK-OS"
    ];

    testItemCodes.forEach(itemCode => {
        // This is how modelRef is extracted in fetchGoogleSheet.ts (line 679)
        const parts = itemCode.split("-");
        const modelRef = parts[0] || itemCode; // This gives "HBSE" - WRONG!
        const colorCode = parts.length >= 2 ? parts[1].toUpperCase() : ""; // This gives "125" - WRONG!
        
        console.log(`   itemCode: "${itemCode}"`);
        console.log(`     → modelRef extrait: "${modelRef}" (❌ devrait être "HBSE-125-0011")`);
        console.log(`     → colorCode extrait: "${colorCode}" (❌ devrait être "BLACK")\n`);
    });

    // 3. Check what the correct extraction should be
    console.log("3. Extraction correcte:\n");
    testItemCodes.forEach(itemCode => {
        // For SAM EDELMAN, itemCode format is: "HBSE-125-0011-BLACK-OS"
        // modelRef should be: "HBSE-125-0011" (first 3 parts)
        // color should be: "BLACK" (4th part)
        
        const parts = itemCode.split("-");
        const modelRef = parts.slice(0, 3).join("-"); // "HBSE-125-0011"
        const color = parts[3] || ""; // "BLACK"
        
        console.log(`   itemCode: "${itemCode}"`);
        console.log(`     → modelRef correct: "${modelRef}"`);
        console.log(`     → color correct: "${color}"\n`);
    });
}

main().catch(console.error);

