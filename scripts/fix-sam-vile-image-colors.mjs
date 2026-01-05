/**
 * Fix image colors in image_index table by removing numeric suffixes (_1, _2, etc.)
 * This fixes SAM EDELMAN images that were indexed with colors like "BLACK_1" instead of "BLACK"
 * 
 * Usage: node scripts/fix-sam-vile-image-colors.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

/**
 * Remove numeric suffixes from color (e.g., "BLACK_1" -> "BLACK", "TAUPE_2" -> "TAUPE")
 */
function cleanColor(color) {
    if (!color) return color;
    return color.replace(/_\d+(_\d+)*$/, "").trim();
}

/**
 * Main function
 */
async function main() {
    console.log("🔧 Fixing image colors in image_index table...");
    console.log("   Removing numeric suffixes (_1, _2, etc.) from colors\n");

    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;
    let totalFixed = 0;
    let totalChecked = 0;

    while (hasMore) {
        // Fetch a batch of images
        const { data: images, error } = await supabase
            .from('image_index')
            .select('id, model_ref, color, filename')
            .range(offset, offset + pageSize - 1)
            .order('id', { ascending: true });

        if (error) {
            console.error(`❌ Error fetching images at offset ${offset}:`, error.message);
            break;
        }

        if (!images || images.length === 0) {
            hasMore = false;
            break;
        }

        totalChecked += images.length;

        // Find images with numeric suffixes in color
        const toFix = images.filter(img => {
            const cleaned = cleanColor(img.color);
            return cleaned !== img.color && cleaned.length > 0;
        });

        // Update each image with cleaned color
        for (const img of toFix) {
            const cleanedColor = cleanColor(img.color);
            const { error: updateError } = await supabase
                .from('image_index')
                .update({ color: cleanedColor })
                .eq('id', img.id);

            if (updateError) {
                console.error(`❌ Error updating image ${img.id} (${img.filename}):`, updateError.message);
            } else {
                totalFixed++;
                if (totalFixed <= 10) {
                    console.log(`✅ Fixed: ${img.filename} - "${img.color}" -> "${cleanedColor}"`);
                }
            }
        }

        if (images.length < pageSize) {
            hasMore = false;
        } else {
            offset += pageSize;
        }

        // Progress indicator
        if (totalChecked % 5000 === 0) {
            console.log(`   Checked ${totalChecked} images, fixed ${totalFixed} so far...`);
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 RÉSUMÉ");
    console.log("=".repeat(60));
    console.log(`📝 Images vérifiées:    ${totalChecked}`);
    console.log(`✅ Images corrigées:     ${totalFixed}`);
    console.log("=".repeat(60));
    console.log("\n✅ Terminé ! Les couleurs des images ont été corrigées.");
    console.log("   Les produits SAM EDELMAN devraient maintenant avoir les bonnes images.");
}

main().catch(console.error);

