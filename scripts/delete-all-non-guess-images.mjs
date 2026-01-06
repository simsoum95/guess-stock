import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Variables Supabase manquantes");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET_NAME = 'guess-images';

// GUESS prefixes - we want to KEEP these
const GUESS_PREFIXES = [
    'PD', 'CV', 'GS', 'GB', 'HW', 'BG', 'MB', 'SG',
    'GH', 'GE', 'GM', 'GC', 'GR', 'GA', 'GF', 'GG',
    'GT', 'GL', 'GN', 'GP', 'GI', 'GJ', 'GK', 'GV',
    'GW', 'GX', 'GY', 'GZ', 'QG', 'VG', 'WG', 'ZG',
    'AG', 'BW', 'CG', 'DG', 'EG', 'FG', 'HG', 'IG',
    'JG', 'KG', 'LG', 'MG', 'NG', 'OG', 'PG', 'RG',
    'TG', 'UG', 'XG', 'YG'
];

async function main() {
    console.log("🗑️  Suppression de TOUTES les images non-GUESS");
    console.log("=".repeat(60));

    // First, count how many we're going to delete
    const whereClause = GUESS_PREFIXES.map(p => `model_ref NOT ILIKE '${p}%'`).join(' AND ');
    
    const { count: totalCount, error: countError } = await supabase
        .from('image_index')
        .select('*', { count: 'exact', head: true })
        .not('model_ref', 'ilike', 'PD%')
        .not('model_ref', 'ilike', 'CV%')
        .not('model_ref', 'ilike', 'GS%')
        .not('model_ref', 'ilike', 'GB%')
        .not('model_ref', 'ilike', 'HW%')
        .not('model_ref', 'ilike', 'BG%')
        .not('model_ref', 'ilike', 'MB%')
        .not('model_ref', 'ilike', 'SG%')
        .not('model_ref', 'ilike', 'QG%')
        .not('model_ref', 'ilike', 'ZG%')
        .not('model_ref', 'ilike', 'VG%')
        .not('model_ref', 'ilike', 'WG%');

    if (countError) {
        console.error("❌ Erreur lors du comptage:", countError.message);
        return;
    }

    console.log(`📊 Total d'images non-GUESS à supprimer: ${totalCount}`);
    console.log("=".repeat(60));

    let totalDeletedFromDb = 0;
    let totalDeletedFromStorage = 0;
    let offset = 0;
    const pageSize = 500;
    let hasMore = true;
    let batch = 0;

    while (hasMore) {
        batch++;
        console.log(`\n📦 Batch ${batch}: Récupération des images (offset ${offset})...`);

        // Fetch images that are NOT GUESS
        const { data: images, error } = await supabase
            .from('image_index')
            .select('id, filename, model_ref, url')
            .not('model_ref', 'ilike', 'PD%')
            .not('model_ref', 'ilike', 'CV%')
            .not('model_ref', 'ilike', 'GS%')
            .not('model_ref', 'ilike', 'GB%')
            .not('model_ref', 'ilike', 'HW%')
            .not('model_ref', 'ilike', 'BG%')
            .not('model_ref', 'ilike', 'MB%')
            .not('model_ref', 'ilike', 'SG%')
            .not('model_ref', 'ilike', 'QG%')
            .not('model_ref', 'ilike', 'ZG%')
            .not('model_ref', 'ilike', 'VG%')
            .not('model_ref', 'ilike', 'WG%')
            .range(0, pageSize - 1) // Always start from 0 since we're deleting
            .order('id', { ascending: true });

        if (error) {
            console.error(`❌ Erreur lors de la récupération des images:`, error.message);
            break;
        }

        if (!images || images.length === 0) {
            hasMore = false;
            console.log("   ✅ Plus d'images à supprimer");
            break;
        }

        console.log(`   📸 ${images.length} images trouvées dans ce batch`);

        // Delete from storage
        const filePaths = images.map(img => {
            // Extract file path from URL or construct it
            if (img.url && img.url.includes('/storage/')) {
                const urlParts = img.url.split('/storage/v1/object/public/guess-images/');
                if (urlParts[1]) {
                    return urlParts[1];
                }
            }
            return `products/${img.model_ref}/${img.filename}`;
        });

        // Delete from storage in batches of 100 (Supabase limit)
        const storageChunks = [];
        for (let i = 0; i < filePaths.length; i += 100) {
            storageChunks.push(filePaths.slice(i, i + 100));
        }

        for (const chunk of storageChunks) {
            const { error: deleteFilesError } = await supabase.storage
                .from(BUCKET_NAME)
                .remove(chunk);

            if (deleteFilesError) {
                console.error(`   ⚠️ Erreur suppression storage:`, deleteFilesError.message);
            } else {
                totalDeletedFromStorage += chunk.length;
            }
        }

        // Delete from image_index table
        const ids = images.map(img => img.id);
        const { error: deleteDbError } = await supabase
            .from('image_index')
            .delete()
            .in('id', ids);

        if (deleteDbError) {
            console.error(`   ❌ Erreur suppression DB:`, deleteDbError.message);
        } else {
            totalDeletedFromDb += images.length;
            console.log(`   ✅ ${images.length} images supprimées (Total: ${totalDeletedFromDb})`);
        }

        // Progress
        const progress = ((totalDeletedFromDb / totalCount) * 100).toFixed(1);
        console.log(`   📈 Progression: ${progress}%`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 RÉSUMÉ FINAL");
    console.log("=".repeat(60));
    console.log(`🗑️  Images supprimées de l'index: ${totalDeletedFromDb}`);
    console.log(`🗑️  Fichiers supprimés du storage: ${totalDeletedFromStorage}`);
    console.log("=".repeat(60));
    console.log("\n✅ Suppression terminée!");
}

main().catch(console.error);

