#!/usr/bin/env node
/**
 * Script pour supprimer toutes les images SAM EDELMAN et VILEBREQUIN
 * de Supabase Storage et de la table image_index
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables Supabase manquantes');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Préfixes pour SAM EDELMAN et VILEBREQUIN
const PREFIXES = [
    // VILEBREQUIN
    'JIMC', 'JIMA', 'JIHI', 'JIIA', 'JOIU', 'BMBA', 'CPPA', 'PYRE', 'VBQ',
    // SAM EDELMAN
    'HBSE', 'FESE', 'SBSE', 'SAMEDELMAN', 'SE_'
];

async function main() {
    console.log('🗑️  Suppression des images SAM EDELMAN et VILEBREQUIN');
    console.log('=' .repeat(60));
    
    let totalDeleted = 0;
    let totalStorageDeleted = 0;
    
    for (const prefix of PREFIXES) {
        console.log(`\n📋 Recherche des images avec préfixe "${prefix}"...`);
        
        // Récupérer toutes les images avec ce préfixe
        const { data: images, error } = await supabase
            .from('image_index')
            .select('id, filename, url, model_ref')
            .ilike('model_ref', `${prefix}%`);
        
        if (error) {
            console.error(`   ❌ Erreur: ${error.message}`);
            continue;
        }
        
        if (!images || images.length === 0) {
            console.log(`   ⚠️ Aucune image trouvée`);
            continue;
        }
        
        console.log(`   📸 ${images.length} images trouvées`);
        
        // Supprimer du Storage
        const filenames = images.map(img => img.filename);
        
        // Supprimer par lots de 100
        for (let i = 0; i < filenames.length; i += 100) {
            const batch = filenames.slice(i, i + 100);
            const { error: storageError } = await supabase.storage
                .from('guess-images')
                .remove(batch);
            
            if (storageError) {
                console.warn(`   ⚠️ Erreur suppression storage: ${storageError.message}`);
            } else {
                totalStorageDeleted += batch.length;
            }
        }
        
        // Supprimer de image_index
        const ids = images.map(img => img.id);
        
        for (let i = 0; i < ids.length; i += 100) {
            const batch = ids.slice(i, i + 100);
            const { error: deleteError } = await supabase
                .from('image_index')
                .delete()
                .in('id', batch);
            
            if (deleteError) {
                console.error(`   ❌ Erreur suppression index: ${deleteError.message}`);
            } else {
                totalDeleted += batch.length;
            }
        }
        
        console.log(`   ✅ ${images.length} images supprimées pour "${prefix}"`);
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('=' .repeat(60));
    console.log(`🗑️  Images supprimées de l'index: ${totalDeleted}`);
    console.log(`🗑️  Fichiers supprimés du storage: ${totalStorageDeleted}`);
    console.log('=' .repeat(60));
    console.log('\n✅ Suppression terminée!');
}

main().catch(console.error);

