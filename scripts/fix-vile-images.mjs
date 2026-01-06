/**
 * Fix VILEBREQUIN images: correct modelRef (PYRE9O00 -> PYRE9000) and color (315-BACK -> 315)
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

function fixVileImage(filename, currentModelRef, currentColor) {
    // Pattern: PYRE9000-315-back.jpg or PYRE9O00-315-back.jpg
    // Match PYRE followed by digits/O, then dash, then digits (color code), then -back or -front
    const match = filename.match(/^(PYRE[0-9O]+)-(\d+)-(back|front)/i);
    if (match) {
        const modelRef = match[1].toUpperCase().replace(/O/g, '0'); // Fix O -> 0 (PYRE9O00 -> PYRE9000)
        const color = match[2].toUpperCase(); // Just the number (315), not "315-BACK"
        return { modelRef, color };
    }
    
    // Also handle: PYRE9O00-315-back.jpg (with space: "PYRE9O00-315 -back.jpg")
    const match2 = filename.match(/^(PYRE[0-9O]+)-(\d+)\s*-(back|front)/i);
    if (match2) {
        const modelRef = match2[1].toUpperCase().replace(/O/g, '0');
        const color = match2[2].toUpperCase();
        return { modelRef, color };
    }
    
    return null;
}

async function main() {
    console.log("🔧 Fixing VILEBREQUIN images...\n");

    const { data: images, error } = await supabase
        .from('image_index')
        .select('id, model_ref, color, filename')
        .or('filename.ilike.PYRE%,filename.ilike.VBQ%')
        .order('id', { ascending: true });

    if (error) {
        console.error("❌ Erreur:", error.message);
        return;
    }

    console.log(`✅ Trouvé ${images.length} images à vérifier\n`);

    let updated = 0;
    let skipped = 0;

    for (const img of images) {
        const fixed = fixVileImage(img.filename, img.model_ref, img.color);
        
        if (!fixed) {
            skipped++;
            continue;
        }

        const needsUpdate = 
            fixed.modelRef !== img.model_ref.toUpperCase() ||
            fixed.color !== img.color.toUpperCase();

        if (!needsUpdate) {
            skipped++;
            continue;
        }

        const { error: updateError } = await supabase
            .from('image_index')
            .update({
                model_ref: fixed.modelRef,
                color: fixed.color,
            })
            .eq('id', img.id);

        if (updateError) {
            console.error(`❌ Erreur pour ${img.filename}:`, updateError.message);
        } else {
            updated++;
            if (updated <= 20) {
                console.log(`✅ ${img.filename}: "${img.model_ref}|${img.color}" -> "${fixed.modelRef}|${fixed.color}"`);
            }
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 RÉSUMÉ");
    console.log("=".repeat(60));
    console.log(`📝 Images vérifiées:    ${images.length}`);
    console.log(`✅ Images corrigées:     ${updated}`);
    console.log(`⏭️  Images ignorées:     ${skipped}`);
    console.log("=".repeat(60));
}

main().catch(console.error);

