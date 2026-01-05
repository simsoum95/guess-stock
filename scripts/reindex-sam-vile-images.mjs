/**
 * Re-index SAM EDELMAN and VILEBREQUIN images with corrected parsing
 * This script will update the model_ref and color in image_index table
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

function cleanFilename(filename) {
    return filename.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function parseImageFilename(fileName) {
    const cleanedFileName = cleanFilename(fileName);
    const baseName = cleanedFileName.replace(/\.[^/.]+$/, "").trim();

    // Pattern 1: MODELREF_COLOR (e.g., "HBSE-125-0011_BLACK_1")
    if (baseName.includes("_")) {
        const parts = baseName.split("_");
        if (parts.length >= 2) {
            let modelRef = parts[0].trim().toUpperCase();
            let color = parts[1].trim().toUpperCase();
            
            if (modelRef && color && modelRef.length > 0 && color.length > 0) {
                return { modelRef, color };
            }
        }
    }
    
    // Pattern 2: MODELREF-COLOR
    if (baseName.includes("-")) {
        const parts = baseName.split("-");
        if (parts.length >= 2) {
            const modelRef = parts[0].trim().toUpperCase();
            const color = parts.slice(1).join("-").trim().toUpperCase();
            if (modelRef && color && modelRef.length > 0 && color.length > 0) {
                return { modelRef, color };
            }
        }
    }

    return null;
}

async function main() {
    console.log("🔧 Re-indexing SAM EDELMAN and VILEBREQUIN images...\n");

    // Get all SAM EDELMAN and VILEBREQUIN images
    const { data: images, error: fetchError } = await supabase
        .from('image_index')
        .select('id, model_ref, color, filename')
        .or('model_ref.ilike.HBSE%,model_ref.ilike.VBQ%,model_ref.ilike.SE%')
        .order('id', { ascending: true });

    if (fetchError) {
        console.error("❌ Erreur:", fetchError.message);
        return;
    }

    console.log(`✅ Trouvé ${images.length} images à vérifier\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const img of images) {
        const parsed = parseImageFilename(img.filename);
        
        if (!parsed) {
            skipped++;
            continue;
        }

        // Check if update is needed
        const needsUpdate = 
            parsed.modelRef !== img.model_ref.toUpperCase() ||
            parsed.color !== img.color.toUpperCase();

        if (!needsUpdate) {
            skipped++;
            continue;
        }

        // Update the image
        const { error: updateError } = await supabase
            .from('image_index')
            .update({
                model_ref: parsed.modelRef,
                color: parsed.color,
            })
            .eq('id', img.id);

        if (updateError) {
            console.error(`❌ Erreur pour ${img.filename}:`, updateError.message);
            errors++;
        } else {
            updated++;
            if (updated <= 20) {
                console.log(`✅ ${img.filename}: "${img.model_ref}|${img.color}" -> "${parsed.modelRef}|${parsed.color}"`);
            }
        }

        if (updated % 100 === 0) {
            console.log(`   Progression: ${updated} images mises à jour...`);
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 RÉSUMÉ");
    console.log("=".repeat(60));
    console.log(`📝 Images vérifiées:    ${images.length}`);
    console.log(`✅ Images mises à jour:  ${updated}`);
    console.log(`⏭️  Images ignorées:     ${skipped}`);
    console.log(`❌ Erreurs:              ${errors}`);
    console.log("=".repeat(60));
    console.log("\n✅ Terminé ! Les images ont été re-indexées.");
}

main().catch(console.error);

