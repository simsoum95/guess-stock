#!/usr/bin/env node
/**
 * Script pour CORRIGER les images VILEBREQUIN
 * 
 * Ce script :
 * 1. Supprime les anciennes images avec des couleurs incorrectes
 * 2. Re-télécharge les images avec les bonnes couleurs depuis GlobalOnline
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';

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

// Mapping des codes couleur GlobalOnline vers noms de couleur
const COLOR_CODE_MAPPING = {
    '010': 'BLANC',
    '001': 'BLANC',
    '390': 'BLEU MARINE',
    '315': 'BLEU',
    '399': 'NOIR',
    '990': 'NOIR',  // Code alternatif pour NOIR
    '371': 'BEIGE',
    '300': 'BLEU CIEL',
    '391': 'BLEU NEON',
    '313': 'TOPAZE BLEUE',
    '305': 'BLEU HAWAI',
    '314': 'BLEU JEAN',
    '310': 'BLEU DE MER',
    '311': 'BLEU TROPEZIEN',
    '312': 'BLEU FUMEE',
    '319': 'MARINE 2',
};

// Liste des produits à corriger (peuvent être passés en argument)
const productsToFix = process.argv.slice(2).length > 0 
    ? process.argv.slice(2).map(p => p.toUpperCase())
    : ['PLTH2N00', 'PYRE9O00', 'CRSU3U00'];

const stats = {
    deleted: 0,
    uploaded: 0,
    errors: 0
};

/**
 * Scrape les images d'un produit depuis GlobalOnline
 */
async function scrapeProductImages(modelRef) {
    const url = `https://www.globalonline.co.il/${modelRef.toLowerCase()}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });
        
        if (!response.ok) {
            return { found: false, colorVariants: {} };
        }
        
        const html = await response.text();
        const colorVariants = {};
        
        // Extraire les noms de fichiers d'images du HTML
        const imagePattern = new RegExp(`${modelRef}[^"'\\s]*\\.(?:jpg|jpeg|png|webp)`, 'gi');
        const allImageFilenames = new Set();
        let match;
        
        while ((match = imagePattern.exec(html)) !== null) {
            allImageFilenames.add(match[0]);
        }
        
        // Organiser les images par code couleur
        const imagesByColorAndIndex = {};
        
        for (const filename of allImageFilenames) {
            const parts = filename.match(/([A-Z0-9]+)_(\d{3})_(\d+)(?:_\d+)?\.(\w+)$/i);
            if (parts) {
                const colorCode = parts[2];
                const imageIndex = parseInt(parts[3]);
                
                if (!imagesByColorAndIndex[colorCode]) {
                    imagesByColorAndIndex[colorCode] = {};
                }
                
                if (!imagesByColorAndIndex[colorCode][imageIndex]) {
                    const firstLetter = modelRef[0].toUpperCase();
                    const secondLetter = modelRef[1].toUpperCase();
                    const fullUrl = `https://www.globalonline.co.il/media/catalog/product/${firstLetter}/${secondLetter}/${filename}`;
                    imagesByColorAndIndex[colorCode][imageIndex] = fullUrl;
                }
            }
        }
        
        // Convertir en format final
        for (const [colorCode, imagesByIndex] of Object.entries(imagesByColorAndIndex)) {
            const sortedIndexes = Object.keys(imagesByIndex).map(Number).sort((a, b) => a - b);
            const images = sortedIndexes.map(idx => imagesByIndex[idx]);
            
            colorVariants[colorCode] = {
                colorName: COLOR_CODE_MAPPING[colorCode] || colorCode,
                images: images
            };
        }
        
        return { found: Object.keys(colorVariants).length > 0, colorVariants };
    } catch (error) {
        return { found: false, colorVariants: {}, error: error.message };
    }
}

/**
 * Supprime les anciennes images d'un produit
 */
async function deleteOldImages(modelRef) {
    console.log(`   🗑️ Suppression des anciennes images pour ${modelRef}...`);
    
    // Récupérer les anciennes images
    const { data: oldImages, error: fetchError } = await supabase
        .from('image_index')
        .select('id, filename')
        .eq('model_ref', modelRef);
    
    if (fetchError) {
        console.error(`   ❌ Erreur récupération:`, fetchError.message);
        return;
    }
    
    if (!oldImages || oldImages.length === 0) {
        console.log(`   ℹ️ Aucune ancienne image trouvée`);
        return;
    }
    
    // Supprimer du storage
    for (const img of oldImages) {
        await supabase.storage.from('guess-images').remove([img.filename]);
    }
    
    // Supprimer de l'index
    const { error: deleteError } = await supabase
        .from('image_index')
        .delete()
        .eq('model_ref', modelRef);
    
    if (deleteError) {
        console.error(`   ❌ Erreur suppression:`, deleteError.message);
    } else {
        console.log(`   ✅ ${oldImages.length} anciennes images supprimées`);
        stats.deleted += oldImages.length;
    }
}

/**
 * Télécharge et uploade une image
 */
async function downloadAndUploadImage(imageUrl, modelRef, colorCode, colorName, index) {
    try {
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const buffer = Buffer.from(await response.arrayBuffer());
        
        const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
        const filename = `${modelRef}_${colorName.replace(/\s+/g, '_')}_${index}${ext}`.toUpperCase();
        
        // Uploader sur Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('guess-images')
            .upload(filename, buffer, {
                contentType: `image/${ext.slice(1)}`,
                upsert: true
            });
        
        if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
        }
        
        // Obtenir l'URL publique
        const { data: { publicUrl } } = supabase.storage
            .from('guess-images')
            .getPublicUrl(filename);
        
        // Indexer dans image_index
        const { error: indexError } = await supabase
            .from('image_index')
            .upsert({
                model_ref: modelRef.toUpperCase(),
                color: colorName.toUpperCase(),
                filename: filename,
                url: publicUrl,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'filename'
            });
        
        if (indexError) {
            console.warn(`   ⚠️ Indexation échouée:`, indexError.message);
        }
        
        return { success: true, filename };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

/**
 * Traite un produit
 */
async function processProduct(modelRef) {
    console.log(`\n🔍 Traitement de ${modelRef}...`);
    
    // 1. Scraper les images
    const { found, colorVariants, error } = await scrapeProductImages(modelRef);
    
    if (!found) {
        console.log(`   ❌ Produit non trouvé sur GlobalOnline`);
        stats.errors++;
        return;
    }
    
    // Afficher les couleurs trouvées
    const colorsInfo = Object.entries(colorVariants)
        .map(([code, data]) => `${data.colorName}(${data.images.length} imgs)`)
        .join(', ');
    console.log(`   📸 Couleurs trouvées: ${colorsInfo}`);
    
    // 2. Supprimer les anciennes images
    await deleteOldImages(modelRef);
    
    // 3. Télécharger et uploader les nouvelles images
    for (const [colorCode, data] of Object.entries(colorVariants)) {
        console.log(`   📥 Téléchargement couleur ${data.colorName}...`);
        
        // Limiter à 5 images par couleur
        const maxImages = Math.min(data.images.length, 5);
        
        for (let i = 0; i < maxImages; i++) {
            const result = await downloadAndUploadImage(
                data.images[i],
                modelRef,
                colorCode,
                data.colorName,
                i + 1
            );
            
            if (result.success) {
                console.log(`      ✅ ${result.filename}`);
                stats.uploaded++;
            } else {
                console.log(`      ❌ Échec: ${result.reason}`);
                stats.errors++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
}

/**
 * Fonction principale
 */
async function main() {
    console.log('🔧 Correction des images VILEBREQUIN');
    console.log('='.repeat(60));
    console.log(`📋 Produits à corriger: ${productsToFix.join(', ')}`);
    console.log('='.repeat(60));
    
    for (const product of productsToFix) {
        await processProduct(product);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`🗑️ Images supprimées: ${stats.deleted}`);
    console.log(`📸 Images uploadées:  ${stats.uploaded}`);
    console.log(`❌ Erreurs:           ${stats.errors}`);
    console.log('='.repeat(60));
    console.log('\n✅ Correction terminée!');
}

main().catch(console.error);

