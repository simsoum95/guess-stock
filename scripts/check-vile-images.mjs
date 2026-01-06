/**
 * Check VILEBREQUIN images in database
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
    console.log("🔍 Vérification des images VILEBREQUIN dans la base de données\n");

    // Get all VILEBREQUIN images (PYRE prefix or VBQ prefix)
    const { data: images, error } = await supabase
        .from('image_index')
        .select('model_ref, color, filename')
        .or('model_ref.ilike.PYRE%,model_ref.ilike.VBQ%')
        .order('model_ref', { ascending: true })
        .limit(50);

    if (error) {
        console.error("❌ Erreur:", error.message);
        return;
    }

    if (!images || images.length === 0) {
        console.log("⚠️  Aucune image VILEBREQUIN trouvée");
        return;
    }

    console.log(`✅ Trouvé ${images.length} images VILEBREQUIN\n`);

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

    // Show all modelRefs with their colors
    for (const [modelRef, imgs] of byModelRef.entries()) {
        const colors = [...new Set(imgs.map(img => img.color))];
        console.log(`${modelRef}:`);
        console.log(`  Couleurs: ${colors.join(', ')}`);
        console.log(`  Total images: ${imgs.length}`);
        console.log(`  Exemples: ${imgs.slice(0, 5).map(img => img.filename).join(', ')}\n`);
    }
}

main().catch(console.error);

