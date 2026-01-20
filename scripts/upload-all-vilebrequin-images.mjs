#!/usr/bin/env node
/**
 * Script COMPLET pour télécharger et uploader TOUTES les images VILEBREQUIN
 * depuis GlobalOnline vers Supabase Storage.
 * 
 * Ce script :
 * 1. Récupère TOUS les produits/couleurs VILEBREQUIN depuis image_index
 * 2. Vérifie quels fichiers manquent dans le Storage
 * 3. Télécharge depuis GlobalOnline et uploade dans Supabase
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

// Mapping des couleurs vers les codes GlobalOnline
const COLOR_TO_CODE = {
    'BLANC': '010',
    'BLEU MARINE': '390',
    'NOIR': '990',
    'BLEU': '315',
    'BLEU CIEL': '300',
    'ROSE': '420',
    'ROUGE': '302',
    'ORANGE': '303',
    'JAUNE': '103',
    'VERT': '500',
    'VERT FONCE': '599',
    'GRIS': '900',
    'GRIS FONCE': '930',
    'TURQUOISE': '312',
    'MARINE': '390'
};

// Délai entre les requêtes pour éviter le rate limiting
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getExistingFiles() {
    console.log('📂 Récupération des fichiers existants dans Storage...');
    const existingFiles = new Set();
    
    let offset = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
        const { data, error } = await supabase.storage
            .from('guess-images')
            .list('', { limit, offset });
        
        if (error) {
            console.error('Erreur:', error);
            break;
        }
        
        if (data && data.length > 0) {
            data.forEach(f => existingFiles.add(f.name));
            offset += limit;
            hasMore = data.length === limit;
        } else {
            hasMore = false;
        }
    }
    
    console.log(`✅ ${existingFiles.size} fichiers existants trouvés`);
    return existingFiles;
}

async function getMissingImages() {
    console.log('📋 Récupération des images manquantes depuis image_index...');
    
    // Récupérer toutes les entrées VILEBREQUIN
    const { data: entries, error } = await supabase
        .from('image_index')
        .select('model_ref, color, filename, url')
        .or('model_ref.like.CR%,model_ref.like.PL%,model_ref.like.PY%,model_ref.like.FL%,model_ref.like.MO%,model_ref.like.JI%,model_ref.like.AC%,model_ref.like.BM%');
    
    if (error) {
        console.error('Erreur:', error);
        return [];
    }
    
    console.log(`📋 ${entries.length} entrées VILEBREQUIN dans image_index`);
    
    // Récupérer les fichiers existants
    const existingFiles = await getExistingFiles();
    
    // Filtrer les images manquantes
    const missing = entries.filter(e => !existingFiles.has(e.filename));
    console.log(`❌ ${missing.length} images manquantes à télécharger`);
    
    return missing;
}

async function downloadImage(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) {
            return null;
        }
        
        return await response.arrayBuffer();
    } catch (error) {
        return null;
    }
}

async function uploadToSupabase(filename, imageBuffer) {
    const { error } = await supabase.storage
        .from('guess-images')
        .upload(filename, imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true
        });
    
    return !error;
}

async function buildGlobalOnlineUrl(modelRef, color, imageNum) {
    // Construire l'URL GlobalOnline basée sur le modèle et la couleur
    const colorCode = COLOR_TO_CODE[color] || color;
    
    // Essayer différents formats d'URL GlobalOnline
    const urlPatterns = [
        // Format standard avec code couleur
        `https://www.globalonline.co.il/media/catalog/product/${modelRef.charAt(0).toLowerCase()}/${modelRef.charAt(1).toLowerCase()}/${modelRef}_${colorCode}_${imageNum}.jpg`,
        `https://www.globalonline.co.il/media/catalog/product/${modelRef.charAt(0).toLowerCase()}/${modelRef.charAt(1).toLowerCase()}/${modelRef}_${colorCode}_${imageNum}_2.jpg`,
        // Format majuscule
        `https://www.globalonline.co.il/media/catalog/product/${modelRef.charAt(0).toUpperCase()}/${modelRef.charAt(1).toUpperCase()}/${modelRef}_${colorCode}_${imageNum}.jpg`,
        `https://www.globalonline.co.il/media/catalog/product/${modelRef.charAt(0).toUpperCase()}/${modelRef.charAt(1).toUpperCase()}/${modelRef}_${colorCode}_${imageNum}_2.jpg`,
    ];
    
    return urlPatterns;
}

async function processImages() {
    const missing = await getMissingImages();
    
    if (missing.length === 0) {
        console.log('✅ Toutes les images sont déjà présentes !');
        return;
    }
    
    console.log('\n🚀 Début du téléchargement et upload...\n');
    
    let uploaded = 0;
    let failed = 0;
    
    // Grouper par modelRef et couleur pour traiter efficacement
    const grouped = {};
    for (const entry of missing) {
        const key = `${entry.model_ref}_${entry.color}`;
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(entry);
    }
    
    for (const [key, entries] of Object.entries(grouped)) {
        const [modelRef, ...colorParts] = key.split('_');
        const color = colorParts.join('_');
        
        console.log(`\n📦 ${modelRef} - ${color} (${entries.length} images)`);
        
        for (const entry of entries) {
            // Extraire le numéro d'image du filename
            const match = entry.filename.match(/_(\d+)\.JPG$/i);
            const imageNum = match ? parseInt(match[1]) : 1;
            
            // Construire les URLs possibles
            const urls = await buildGlobalOnlineUrl(modelRef, color, imageNum);
            
            let success = false;
            for (const url of urls) {
                const imageBuffer = await downloadImage(url);
                if (imageBuffer) {
                    const uploadSuccess = await uploadToSupabase(entry.filename, imageBuffer);
                    if (uploadSuccess) {
                        console.log(`   ✅ ${entry.filename}`);
                        uploaded++;
                        success = true;
                        break;
                    }
                }
            }
            
            if (!success) {
                console.log(`   ❌ ${entry.filename} - Non trouvé sur GlobalOnline`);
                failed++;
            }
            
            // Petite pause pour éviter le rate limiting
            await delay(100);
        }
    }
    
    console.log(`\n📊 Résumé:`);
    console.log(`   ✅ ${uploaded} images uploadées`);
    console.log(`   ❌ ${failed} images non trouvées`);
}

// Exécuter le script
processImages().catch(console.error);




