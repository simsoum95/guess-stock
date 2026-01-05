/**
 * Check SAM EDELMAN images in database
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
    console.log("🔍 Vérification des images SAM EDELMAN dans la base de données\n");

    // Get all SAM EDELMAN images (HBSE prefix)
    const { data: images, error } = await supabase
        .from('image_index')
        .select('model_ref, color, filename')
        .ilike('model_ref', 'HBSE%')
        .order('model_ref', { ascending: true })
        .limit(100);

    if (error) {
        console.error("❌ Erreur:", error.message);
        return;
    }

    console.log(`✅ Trouvé ${images.length} images SAM EDELMAN\n`);

    // Group by modelRef
    const byModelRef = new Map();
    images.forEach(img => {
        const key = img.model_ref;
        if (!byModelRef.has(key)) {
            byModelRef.set(key, []);
        }
        byModelRef.get(key).push(img);
    });

    console.log(`📦 ${byModelRef.size} modelRefs différents\n`);

    // Show first 10 modelRefs with their colors
    let count = 0;
    for (const [modelRef, imgs] of byModelRef.entries()) {
        if (count >= 10) break;
        count++;

        const colors = [...new Set(imgs.map(img => img.color))];
        console.log(`${modelRef}:`);
        console.log(`  Couleurs: ${colors.join(', ')}`);
        console.log(`  Total images: ${imgs.length}`);
        console.log(`  Exemples: ${imgs.slice(0, 3).map(img => img.filename).join(', ')}\n`);
    }

    // Check for problematic colors (with underscores or numbers)
    const problematic = images.filter(img => 
        img.color.includes('_') || 
        /\d/.test(img.color) && !img.color.match(/^\d+$/) // numbers but not just numbers
    );

    if (problematic.length > 0) {
        console.log(`\n⚠️  ${problematic.length} images avec des couleurs problématiques:`);
        const uniqueProblems = new Map();
        problematic.forEach(img => {
            const key = `${img.model_ref}|${img.color}`;
            if (!uniqueProblems.has(key)) {
                uniqueProblems.set(key, img);
            }
        });
        Array.from(uniqueProblems.values()).slice(0, 10).forEach(img => {
            console.log(`  ${img.model_ref} | ${img.color} | ${img.filename}`);
        });
    } else {
        console.log("\n✅ Toutes les couleurs semblent correctes");
    }
}

main().catch(console.error);

