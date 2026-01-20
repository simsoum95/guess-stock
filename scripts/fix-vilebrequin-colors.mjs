#!/usr/bin/env node
/**
 * Script pour re-télécharger les images VILEBREQUIN avec le bon mapping de couleur
 * 
 * Le problème: Les images ont été téléchargées avec les mauvais noms de couleur.
 * Sur GlobalOnline:
 * - Code 010 = BLANC (photos blanches)
 * - Code 390 = BLEU MARINE (photos bleues)
 * 
 * Ce script re-télécharge les images en utilisant le bon mapping.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables Supabase manquantes');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =============================================================================
// MAPPING CODES COULEUR GLOBALONLINE -> NOMS DE COULEUR FRANÇAIS
// =============================================================================
const COLOR_CODE_TO_NAME = {
    '010': 'BLANC',
    '390': 'BLEU MARINE',
    '990': 'NOIR',
    '399': 'NOIR',
    '315': 'BLEU',
    '300': 'BLEU CIEL',
    '391': 'BLEU NEON',
    '313': 'TOPAZE BLEUE',
    '305': 'BLEU HAWAI',
    '610': 'ROUGE',
    '320': 'ORANGE',
    '410': 'VERT',
    '710': 'JAUNE',
    '750': 'OR',
    '500': 'ROSE',
    '510': 'FUCHSIA',
    '800': 'MARRON',
    '100': 'GRIS',
    '250': 'SABLE',
    'NULL': 'DEFAULT',
    'DEFAULT': 'DEFAULT',
};

// Liste des modelRef VILEBREQUIN à corriger
const VILEBREQUIN_MODEL_REFS = [
    'PLTH2N00',
    'PYRE9O00',
    'PLTU3N00',
    'PLTU3N02', 
    'PLTAN100',
    'PLTAN300',
    // Ajouter d'autres model_ref si nécessaire
];

const stats = {
    totalProducts: 0,
    productsFixed: 0,
    imagesUploaded: 0,
    imagesDeleted: 0,
    errors: 0,
};

/**
 * Scrape les images depuis GlobalOnline et les organise par code couleur
 */
async function scrapeGlobalOnlineImages(productCode) {
    const url = `https://www.globalonline.co.il/${productCode.toLowerCase()}`;
    
    try {
        console.log(`   📥 Fetch: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
            },
        });
        
        if (!response.ok) {
            if (response.status === 404) return { found: false, colorImages: {} };
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        
        // Map: colorCode -> [imageUrls]
        const colorImages = {};
        
        // Chercher toutes les URLs d'images dans le HTML
        const imgMatches = html.matchAll(/https?:\/\/[^"'\s]+media\/catalog\/product[^"'\s]+\.(jpg|jpeg|png|webp)/gi);
        
        for (const match of imgMatches) {
            let imgUrl = match[0];
            
            // Ignorer les swatches et placeholders
            if (imgUrl.includes('swatch') || imgUrl.includes('placeholder')) continue;
            
            // Extraire le nom de fichier
            const filename = imgUrl.split('/').pop();
            const parts = filename.replace(/\.[^.]+$/, '').split(/[_-]/);
            
            // Le code couleur est généralement le 2ème segment
            // Ex: PLTH2N00_390_1_2.jpg -> 390
            if (parts.length >= 2) {
                let colorCode = parts[1].toUpperCase();
                
                // Vérifier si c'est un code couleur valide (3 chiffres ou NULL)
                if (!colorCode.match(/^\d{3}$/) && colorCode !== 'NULL') {
                    colorCode = 'DEFAULT';
                }
                
                if (!colorImages[colorCode]) {
                    colorImages[colorCode] = new Set();
                }
                
                // Nettoyer l'URL (utiliser l'URL de haute qualité)
                let cleanUrl = imgUrl;
                if (cleanUrl.includes('/cache/')) {
                    // Remplacer /cache/xxx/ par /
                    cleanUrl = cleanUrl.replace(/\/cache\/[a-f0-9]+\//, '/');
                }
                
                colorImages[colorCode].add(cleanUrl);
            }
        }
        
        // Convertir en arrays et trier
        const result = {};
        for (const [code, urls] of Object.entries(colorImages)) {
            const arr = Array.from(urls);
            if (arr.length > 0) {
                // Trier par numéro d'image
                arr.sort((a, b) => {
                    const numA = parseInt(a.match(/_(\d+)(?:_\d+)?\.[^.]+$/)?.[1] || '0');
                    const numB = parseInt(b.match(/_(\d+)(?:_\d+)?\.[^.]+$/)?.[1] || '0');
                    return numA - numB;
                });
                result[code] = arr;
            }
        }
        
        return { found: true, colorImages: result };
    } catch (error) {
        return { found: false, colorImages: {}, error: error.message };
    }
}

/**
 * Supprime toutes les images existantes pour un modelRef
 */
async function deleteExistingImages(modelRef) {
    const { data: existing, error } = await supabase
        .from('image_index')
        .select('id, filename')
        .eq('model_ref', modelRef.toUpperCase());
    
    if (error || !existing || existing.length === 0) return 0;
    
    // Supprimer du storage
    const filenames = existing.map(e => e.filename);
    await supabase.storage.from('guess-images').remove(filenames);
    
    // Supprimer de l'index
    const ids = existing.map(e => e.id);
    await supabase.from('image_index').delete().in('id', ids);
    
    return existing.length;
}

/**
 * Télécharge une image et l'uploade avec le bon nom de couleur
 */
async function downloadAndUpload(imageUrl, modelRef, colorName, index) {
    try {
        const response = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Déterminer l'extension
        const urlPath = new URL(imageUrl).pathname;
        const originalFilename = urlPath.split('/').pop();
        const ext = path.extname(originalFilename) || '.jpg';
        
        // Créer le nom avec le VRAI nom de couleur
        const safeColor = colorName.replace(/\s+/g, '_').replace(/[^A-Z0-9_]/gi, '');
        const filename = `${modelRef.toUpperCase()}_${safeColor}_${index}${ext.toUpperCase()}`;
        
        // Upload
        const { error: uploadError } = await supabase.storage
            .from('guess-images')
            .upload(filename, buffer, {
                contentType: `image/${ext.slice(1).toLowerCase()}`,
                upsert: true
            });
        
        if (uploadError) throw new Error(uploadError.message);
        
        // URL publique
        const { data: { publicUrl } } = supabase.storage
            .from('guess-images')
            .getPublicUrl(filename);
        
        // Indexer
        await supabase.from('image_index').upsert({
            model_ref: modelRef.toUpperCase(),
            color: colorName,
            filename: filename,
            url: publicUrl,
            created_at: new Date().toISOString()
        }, { onConflict: 'filename' });
        
        return { success: true, filename };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Traite un produit
 */
async function processProduct(modelRef) {
    stats.totalProducts++;
    console.log(`\n🔍 [${stats.totalProducts}] Traitement de ${modelRef}`);
    
    // Scraper GlobalOnline
    const { found, colorImages, error } = await scrapeGlobalOnlineImages(modelRef);
    
    if (!found) {
        console.log(`   ❌ ${error || 'Produit non trouvé sur GlobalOnline'}`);
        stats.errors++;
        return;
    }
    
    const colorCodes = Object.keys(colorImages);
    console.log(`   📸 Codes couleur trouvés: ${colorCodes.join(', ')}`);
    
    if (colorCodes.length === 0) {
        console.log(`   ⚠️ Aucune image trouvée`);
        return;
    }
    
    // Supprimer les anciennes images
    const deleted = await deleteExistingImages(modelRef);
    if (deleted > 0) {
        console.log(`   🗑️ ${deleted} anciennes images supprimées`);
        stats.imagesDeleted += deleted;
    }
    
    // Uploader les nouvelles images avec les vrais noms de couleur
    let uploadCount = 0;
    for (const [colorCode, urls] of Object.entries(colorImages)) {
        // Convertir le code en nom de couleur
        const colorName = COLOR_CODE_TO_NAME[colorCode] || `COLOR_${colorCode}`;
        
        console.log(`   🎨 ${colorCode} -> ${colorName} (${urls.length} images)`);
        
        for (let i = 0; i < urls.length; i++) {
            const result = await downloadAndUpload(urls[i], modelRef, colorName, i + 1);
            if (result.success) {
                console.log(`      ✅ ${result.filename}`);
                uploadCount++;
                stats.imagesUploaded++;
            } else {
                console.log(`      ❌ ${result.error}`);
            }
            await new Promise(r => setTimeout(r, 200));
        }
    }
    
    if (uploadCount > 0) {
        stats.productsFixed++;
    }
}

/**
 * Programme principal
 */
async function main() {
    console.log('🚀 Correction des images VILEBREQUIN');
    console.log('='.repeat(60));
    console.log('📋 Mapping des codes couleur:');
    console.log('   010 = BLANC');
    console.log('   390 = BLEU MARINE');
    console.log('   990 = NOIR');
    console.log('='.repeat(60));
    
    // Argument: liste spécifique ou tous
    const specificRef = process.argv[2];
    
    let modelRefs;
    if (specificRef) {
        modelRefs = [specificRef.toUpperCase()];
        console.log(`\n📌 Traitement du produit spécifique: ${modelRefs[0]}`);
    } else {
        // Récupérer tous les modelRef VILEBREQUIN de la base de données
        const { data, error } = await supabase
            .from('image_index')
            .select('model_ref')
            .or('model_ref.like.PL%,model_ref.like.PY%,model_ref.like.JI%,model_ref.like.BMB%,model_ref.like.CPP%');
        
        if (error) {
            console.error('❌ Erreur récupération:', error.message);
            modelRefs = VILEBREQUIN_MODEL_REFS;
        } else {
            modelRefs = [...new Set(data.map(d => d.model_ref))];
        }
        
        console.log(`\n📌 ${modelRefs.length} produits à traiter`);
    }
    
    // Traiter chaque produit
    for (const ref of modelRefs) {
        await processProduct(ref);
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`📝 Produits traités:    ${stats.totalProducts}`);
    console.log(`✅ Produits corrigés:   ${stats.productsFixed}`);
    console.log(`📸 Images uploadées:    ${stats.imagesUploaded}`);
    console.log(`🗑️  Images supprimées:   ${stats.imagesDeleted}`);
    console.log(`❌ Erreurs:             ${stats.errors}`);
    console.log('='.repeat(60));
}

main().catch(console.error);




