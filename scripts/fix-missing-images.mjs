#!/usr/bin/env node
/**
 * Script pour télécharger TOUTES les images manquantes pour les produits 
 * SAM EDELMAN et VILEBREQUIN qui n'ont qu'une seule image actuellement.
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

// Produits avec 1 seule image qui ont besoin de plus d'images
const PRODUCTS_TO_FIX = [
    { modelRef: 'E851906215', color: 'TERAZZOBRO' },
    { modelRef: 'E851917015', color: 'BLACK' },
    { modelRef: 'E851919203', color: 'CAMEL' },
    { modelRef: 'E8519LF407', color: 'BALTICNAVY' },
    { modelRef: 'HBSE-325-0037', color: 'BLEU' },
    { modelRef: 'HBSE-325-0072', color: 'BLEU' }
];

// Mapping des couleurs vers les codes GlobalOnline
const COLOR_TO_CODE = {
    'BLACK': ['BLACK', 'BLAC', 'NULL'],
    'TERAZZOBRO': ['TERAZZOBRO', 'TERAZZ', 'NULL'],
    'CAMEL': ['CAMEL', 'NULL'],
    'BALTICNAVY': ['BALTICNAVY', 'BALTIC', 'NULL'],
    'BLEU': ['BLEU', 'BLUE', 'NULL']
};

/**
 * Essaie de trouver toutes les images sur GlobalOnline pour un produit
 */
async function findAllImages(modelRef, color) {
    const baseUrl = 'https://www.globalonline.co.il/media/catalog/product';
    const possibleColors = COLOR_TO_CODE[color] || [color, 'NULL'];
    const foundImages = [];
    
    // Patterns possibles pour les noms de fichiers
    const firstLetter = modelRef.charAt(0);
    const secondLetter = modelRef.charAt(1);
    
    for (const colorCode of possibleColors) {
        // Essayer plusieurs variantes de noms
        const nameVariants = [
            `${modelRef}_${colorCode}`,
            `${modelRef.toLowerCase()}_${colorCode.toLowerCase()}`,
            `${modelRef}_${colorCode.toLowerCase()}`,
            `${modelRef.toUpperCase()}_${colorCode.toUpperCase()}`
        ];
        
        for (const nameVariant of nameVariants) {
            // Essayer plusieurs numéros d'images (1 à 6)
            for (let num = 1; num <= 6; num++) {
                // Pattern standard: MODEL_COLOR_N.jpg
                const variants = [
                    `${baseUrl}/${firstLetter}/${secondLetter}/${nameVariant}_${num}.jpg`,
                    `${baseUrl}/${firstLetter.toLowerCase()}/${secondLetter.toLowerCase()}/${nameVariant}_${num}.jpg`,
                    `${baseUrl}/${firstLetter}/${secondLetter}/${nameVariant}_${num}_2.jpg`,
                    `${baseUrl}/${firstLetter.toLowerCase()}/${secondLetter.toLowerCase()}/${nameVariant}_${num}_2_2.jpg`,
                ];
                
                for (const url of variants) {
                    try {
                        const response = await fetch(url, { method: 'HEAD' });
                        if (response.ok) {
                            // Vérifier si cette URL n'est pas déjà dans la liste
                            if (!foundImages.includes(url)) {
                                foundImages.push(url);
                                console.log(`    ✓ Trouvé: ${url}`);
                            }
                        }
                    } catch (e) {
                        // Ignorer les erreurs de fetch
                    }
                }
            }
        }
    }
    
    return foundImages;
}

/**
 * Télécharge une image et la sauvegarde dans Supabase Storage
 */
async function downloadAndUploadImage(imageUrl, modelRef, color, imageNumber) {
    try {
        console.log(`    📥 Téléchargement: ${imageUrl}`);
        
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.log(`    ⚠️ Échec du téléchargement: ${response.status}`);
            return null;
        }
        
        const buffer = await response.arrayBuffer();
        const filename = `${modelRef}_${color.replace(/\s+/g, '_')}_${imageNumber}.JPG`;
        
        // Upload vers Supabase Storage
        const { data, error } = await supabase.storage
            .from('guess-images')
            .upload(filename, buffer, {
                contentType: 'image/jpeg',
                upsert: true
            });
        
        if (error) {
            console.log(`    ❌ Erreur upload: ${error.message}`);
            return null;
        }
        
        // Obtenir l'URL publique
        const { data: publicUrlData } = supabase.storage
            .from('guess-images')
            .getPublicUrl(filename);
        
        console.log(`    ✅ Uploadé: ${filename}`);
        
        return {
            filename,
            url: publicUrlData.publicUrl,
            model_ref: modelRef,
            color: color
        };
    } catch (e) {
        console.log(`    ❌ Erreur: ${e.message}`);
        return null;
    }
}

/**
 * Met à jour l'index des images dans Supabase
 */
async function updateImageIndex(imageData) {
    const { error } = await supabase
        .from('image_index')
        .upsert({
            model_ref: imageData.model_ref,
            color: imageData.color,
            filename: imageData.filename,
            url: imageData.url
        }, {
            onConflict: 'filename'
        });
    
    if (error) {
        console.log(`    ❌ Erreur index: ${error.message}`);
        return false;
    }
    
    return true;
}

async function main() {
    console.log('🔧 Correction des images manquantes pour SAM EDELMAN et VILEBREQUIN\n');
    
    let totalNewImages = 0;
    
    for (const product of PRODUCTS_TO_FIX) {
        console.log(`\n📦 Traitement: ${product.modelRef} (${product.color})`);
        
        // Vérifier combien d'images existent déjà
        const { data: existingImages } = await supabase
            .from('image_index')
            .select('*')
            .eq('model_ref', product.modelRef)
            .eq('color', product.color);
        
        const existingCount = existingImages?.length || 0;
        console.log(`   Images existantes: ${existingCount}`);
        
        // Trouver toutes les images sur GlobalOnline
        const foundUrls = await findAllImages(product.modelRef, product.color);
        console.log(`   Images trouvées sur GlobalOnline: ${foundUrls.length}`);
        
        if (foundUrls.length <= existingCount) {
            console.log(`   ✓ Aucune nouvelle image à ajouter`);
            continue;
        }
        
        // Télécharger et indexer les nouvelles images
        let imageNumber = existingCount + 1;
        for (const url of foundUrls.slice(existingCount)) {
            const imageData = await downloadAndUploadImage(url, product.modelRef, product.color, imageNumber);
            if (imageData) {
                const success = await updateImageIndex(imageData);
                if (success) {
                    totalNewImages++;
                    imageNumber++;
                }
            }
        }
    }
    
    console.log(`\n✅ Terminé! ${totalNewImages} nouvelles images ajoutées.`);
}

main().catch(console.error);




