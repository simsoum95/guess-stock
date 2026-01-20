#!/usr/bin/env node
/**
 * Script COMPLET pour corriger toutes les images VILEBREQUIN et SAM EDELMAN
 * 
 * Ce script :
 * 1. Récupère TOUS les produits VILEBREQUIN et SAM EDELMAN depuis Google Sheets
 * 2. Pour chaque produit, scrape GlobalOnline et récupère les images par couleur
 * 3. Utilise le mapping des codes de couleur (010=BLANC, 390=BLEU MARINE, etc.)
 * 4. Supprime les anciennes images incorrectes
 * 5. Uploade les nouvelles images avec les bons noms de couleur
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

// Configuration Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables Supabase manquantes');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =============================================================================
// MAPPING DES CODES DE COULEUR GLOBALONLINE -> NOMS DE COULEUR
// =============================================================================
const COLOR_CODE_TO_NAME = {
    // VILEBREQUIN codes
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
    
    // SAM EDELMAN codes
    'BLACK': 'NOIR',
    'WHITE': 'BLANC',
    'NAVY': 'BLEU MARINE',
    'TAN': 'BEIGE',
    'BROWN': 'MARRON',
    'RED': 'ROUGE',
    'PINK': 'ROSE',
    'NUDE': 'NUDE',
    'GOLD': 'OR',
    'SILVER': 'ARGENT',
    'LEOPARD': 'LEOPARD',
    'MULTI': 'MULTICOLORE',
};

// Stats globales
const stats = {
    totalProducts: 0,
    productsProcessed: 0,
    imagesUploaded: 0,
    imagesDeleted: 0,
    errors: 0,
    skipped: 0,
    notFound: 0
};

/**
 * Récupère les produits VILEBREQUIN et SAM EDELMAN depuis Google Sheets
 */
async function getProductsFromGoogleSheets() {
    console.log('📋 Récupération des produits depuis Google Sheets...');
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || '1i-k_GVXFZ2aVTVJ7WtxOaQE7kA4kZzZLVEK8RFpB5e4';
    let credentials;
    
    try {
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
    } catch (e) {
        console.error('❌ Erreur parsing GOOGLE_SERVICE_ACCOUNT_KEY');
        return [];
    }
    
    if (!credentials.private_key) {
        console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY non configuré');
        return [];
    }
    
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Feuille 1!A:Z',
        });
        
        const rows = response.data.values || [];
        if (rows.length < 2) {
            console.error('❌ Pas de données dans le Google Sheet');
            return [];
        }
        
        const headers = rows[0].map(h => h.toString().toLowerCase().trim());
        const brandIndex = headers.findIndex(h => h.includes('brand') || h.includes('marque') || h === 'brand');
        const modelRefIndex = headers.findIndex(h => h.includes('model') || h.includes('ref') || h === 'modelref');
        const colorIndex = headers.findIndex(h => h.includes('color') || h.includes('couleur') || h === 'color');
        
        console.log(`   Headers trouvés: brand=${brandIndex}, modelRef=${modelRefIndex}, color=${colorIndex}`);
        
        const products = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const brand = row[brandIndex]?.toString().toUpperCase().trim() || '';
            const modelRef = row[modelRefIndex]?.toString().toUpperCase().trim() || '';
            const color = row[colorIndex]?.toString().toUpperCase().trim() || '';
            
            if (modelRef && (brand === 'VILEBREQUIN' || brand === 'SAM EDELMAN')) {
                products.push({ brand, modelRef, color });
            }
        }
        
        // Grouper par modelRef et couleurs
        const productMap = new Map();
        for (const p of products) {
            if (!productMap.has(p.modelRef)) {
                productMap.set(p.modelRef, {
                    brand: p.brand,
                    modelRef: p.modelRef,
                    colors: new Set()
                });
            }
            productMap.get(p.modelRef).colors.add(p.color);
        }
        
        const result = Array.from(productMap.values()).map(p => ({
            ...p,
            colors: Array.from(p.colors).filter(c => c)
        }));
        
        console.log(`   ✅ ${result.length} produits VILEBREQUIN/SAM EDELMAN trouvés`);
        return result;
    } catch (error) {
        console.error('❌ Erreur Google Sheets:', error.message);
        return [];
    }
}

/**
 * Scrape TOUTES les images d'un produit depuis GlobalOnline pour TOUTES les couleurs
 */
async function scrapeAllColorVariants(productCode) {
    const url = `https://www.globalonline.co.il/${productCode.toLowerCase()}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'he-IL,he;q=0.9',
            },
        });
        
        if (!response.ok) {
            if (response.status === 404) return { found: false, colorImages: {} };
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        // Map: colorCode -> [imageUrls]
        const colorImages = {};
        
        // 1. Chercher dans les scripts la configuration des images par couleur
        $('script').each((_, el) => {
            const content = $(el).html() || '';
            
            // Chercher les configurations de swatch/gallery
            // Format: "optionid":{"images":[{"full":"url",...}]}
            try {
                // Regex pour trouver les URLs d'images
                const imgMatches = content.matchAll(/media\/catalog\/product\/[^"'\s]+/g);
                for (const match of imgMatches) {
                    let imgUrl = match[0];
                    if (!imgUrl.startsWith('http')) {
                        imgUrl = `https://www.globalonline.co.il/${imgUrl}`;
                    }
                    
                    // Extraire le code couleur du nom de fichier
                    // Ex: PLTH2N00_390_1_2.jpg -> 390
                    const filename = imgUrl.split('/').pop();
                    const parts = filename.replace(/\.[^.]+$/, '').split(/[_-]/);
                    
                    if (parts.length >= 2) {
                        // Le code couleur est généralement le 2ème segment
                        let colorCode = parts[1].toUpperCase();
                        
                        // Ignorer les fichiers avec "NULL" ou sans vrai code couleur
                        if (colorCode === 'NULL' || colorCode.length > 10) {
                            colorCode = 'DEFAULT';
                        }
                        
                        if (!colorImages[colorCode]) {
                            colorImages[colorCode] = new Set();
                        }
                        
                        // Nettoyer l'URL (enlever le cache)
                        let cleanUrl = imgUrl;
                        if (cleanUrl.includes('/cache/')) {
                            cleanUrl = cleanUrl.replace(/\/cache\/[^/]+\//, '/');
                        }
                        
                        // S'assurer que c'est une image
                        if (cleanUrl.match(/\.(jpg|jpeg|png|webp)$/i)) {
                            colorImages[colorCode].add(cleanUrl);
                        }
                    }
                }
            } catch (e) {
                // Ignore parsing errors
            }
        });
        
        // 2. Chercher dans les images visibles
        $('img[src*="/media/catalog/product"]').each((_, el) => {
            let src = $(el).attr('src');
            if (src && !src.includes('placeholder') && !src.includes('swatch')) {
                if (src.startsWith('/')) src = `https://www.globalonline.co.il${src}`;
                
                const filename = src.split('/').pop();
                const parts = filename.replace(/\.[^.]+$/, '').split(/[_-]/);
                
                if (parts.length >= 2) {
                    let colorCode = parts[1].toUpperCase();
                    if (colorCode === 'NULL' || colorCode.length > 10) {
                        colorCode = 'DEFAULT';
                    }
                    
                    if (!colorImages[colorCode]) {
                        colorImages[colorCode] = new Set();
                    }
                    
                    let cleanUrl = src;
                    if (cleanUrl.includes('/cache/')) {
                        cleanUrl = cleanUrl.replace(/\/cache\/[^/]+\//, '/');
                    }
                    
                    if (cleanUrl.match(/\.(jpg|jpeg|png|webp)$/i)) {
                        colorImages[colorCode].add(cleanUrl);
                    }
                }
            }
        });
        
        // 3. Chercher dans les data attributes
        $('[data-mage-init]').each((_, el) => {
            const data = $(el).attr('data-mage-init') || '';
            const imgMatches = data.matchAll(/media\/catalog\/product\/[^"'\s]+/g);
            for (const match of imgMatches) {
                let imgUrl = match[0];
                if (!imgUrl.startsWith('http')) {
                    imgUrl = `https://www.globalonline.co.il/${imgUrl}`;
                }
                
                const filename = imgUrl.split('/').pop();
                const parts = filename.replace(/\.[^.]+$/, '').split(/[_-]/);
                
                if (parts.length >= 2) {
                    let colorCode = parts[1].toUpperCase();
                    if (colorCode === 'NULL' || colorCode.length > 10) {
                        colorCode = 'DEFAULT';
                    }
                    
                    if (!colorImages[colorCode]) {
                        colorImages[colorCode] = new Set();
                    }
                    
                    let cleanUrl = imgUrl;
                    if (cleanUrl.includes('/cache/')) {
                        cleanUrl = cleanUrl.replace(/\/cache\/[^/]+\//, '/');
                    }
                    
                    if (cleanUrl.match(/\.(jpg|jpeg|png|webp)$/i)) {
                        colorImages[colorCode].add(cleanUrl);
                    }
                }
            }
        });
        
        // Convertir les Sets en Arrays et trier
        const result = {};
        for (const [code, urls] of Object.entries(colorImages)) {
            const arr = Array.from(urls);
            if (arr.length > 0) {
                // Trier pour avoir les images dans l'ordre (_1, _2, _3, etc.)
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
    // Récupérer toutes les images existantes
    const { data: existing, error } = await supabase
        .from('image_index')
        .select('id, filename, url')
        .eq('model_ref', modelRef.toUpperCase());
    
    if (error) {
        console.log(`   ⚠️ Erreur récupération images existantes: ${error.message}`);
        return 0;
    }
    
    if (!existing || existing.length === 0) {
        return 0;
    }
    
    // Supprimer du storage
    const filenames = existing.map(e => e.filename);
    if (filenames.length > 0) {
        await supabase.storage.from('guess-images').remove(filenames);
    }
    
    // Supprimer de l'index
    const ids = existing.map(e => e.id);
    await supabase.from('image_index').delete().in('id', ids);
    
    return existing.length;
}

/**
 * Télécharge et uploade une image
 */
async function downloadAndUploadImage(imageUrl, modelRef, colorName, index) {
    try {
        const response = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Déterminer l'extension
        const urlPath = new URL(imageUrl).pathname;
        const originalFilename = urlPath.split('/').pop();
        const ext = path.extname(originalFilename) || '.jpg';
        
        // Créer le nom de fichier avec la VRAIE couleur
        const safeColorName = colorName.replace(/\s+/g, '_').replace(/[^A-Z0-9_]/gi, '');
        const filename = `${modelRef.toUpperCase()}_${safeColorName}_${index}${ext.toUpperCase()}`;
        
        // Uploader sur Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('guess-images')
            .upload(filename, buffer, {
                contentType: `image/${ext.slice(1).toLowerCase()}`,
                upsert: true
            });
        
        if (uploadError) throw new Error(`Upload: ${uploadError.message}`);
        
        // Obtenir l'URL publique
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
 * Traite un produit complet
 */
async function processProduct(product) {
    const { modelRef, brand, colors } = product;
    stats.totalProducts++;
    
    console.log(`\n🔍 [${stats.totalProducts}] ${modelRef} (${brand})`);
    console.log(`   Couleurs attendues: ${colors.join(', ')}`);
    
    // Scraper les images
    const { found, colorImages, error } = await scrapeAllColorVariants(modelRef);
    
    if (!found) {
        if (error) {
            console.log(`   ❌ Erreur: ${error}`);
            stats.errors++;
        } else {
            console.log(`   ⚠️ Produit non trouvé sur GlobalOnline`);
            stats.notFound++;
        }
        return;
    }
    
    const foundColors = Object.keys(colorImages);
    console.log(`   📸 Codes couleur trouvés: ${foundColors.join(', ')}`);
    
    if (foundColors.length === 0) {
        console.log(`   ⚠️ Aucune image trouvée`);
        stats.skipped++;
        return;
    }
    
    // Supprimer les anciennes images
    const deletedCount = await deleteExistingImages(modelRef);
    if (deletedCount > 0) {
        console.log(`   🗑️ ${deletedCount} anciennes images supprimées`);
        stats.imagesDeleted += deletedCount;
    }
    
    // Pour chaque couleur trouvée sur GlobalOnline
    let uploadedTotal = 0;
    for (const [colorCode, imageUrls] of Object.entries(colorImages)) {
        // Convertir le code couleur en nom de couleur
        let colorName = COLOR_CODE_TO_NAME[colorCode] || colorCode;
        
        // Si c'est un code numérique non mappé, essayer de trouver la couleur correspondante
        if (colorCode.match(/^\d+$/) && colorName === colorCode) {
            // Utiliser le mapping ou garder le code
            colorName = `COLOR_${colorCode}`;
        }
        
        // Essayer de matcher avec les couleurs du Google Sheet
        const matchedSheetColor = colors.find(c => {
            const normalizedC = c.replace(/\s+/g, '').toUpperCase();
            const normalizedName = colorName.replace(/\s+/g, '').toUpperCase();
            return normalizedC === normalizedName || 
                   normalizedC.includes(normalizedName) || 
                   normalizedName.includes(normalizedC);
        });
        
        if (matchedSheetColor) {
            colorName = matchedSheetColor;
        }
        
        console.log(`   🎨 ${colorCode} -> ${colorName} (${imageUrls.length} images)`);
        
        // Uploader chaque image
        for (let i = 0; i < imageUrls.length; i++) {
            const result = await downloadAndUploadImage(imageUrls[i], modelRef, colorName, i + 1);
            if (result.success) {
                uploadedTotal++;
                stats.imagesUploaded++;
            } else {
                console.log(`      ❌ Erreur image ${i + 1}: ${result.error}`);
            }
            
            // Petite pause
            await new Promise(r => setTimeout(r, 200));
        }
    }
    
    if (uploadedTotal > 0) {
        console.log(`   ✅ ${uploadedTotal} images uploadées`);
        stats.productsProcessed++;
    }
}

/**
 * Programme principal
 */
async function main() {
    console.log('🚀 Correction COMPLÈTE des images VILEBREQUIN et SAM EDELMAN');
    console.log('='.repeat(70));
    
    // Récupérer les produits depuis Google Sheets
    const products = await getProductsFromGoogleSheets();
    
    if (products.length === 0) {
        console.log('\n❌ Aucun produit trouvé. Vérifiez la configuration Google Sheets.');
        process.exit(1);
    }
    
    console.log(`\n📊 ${products.length} produits à traiter`);
    console.log('='.repeat(70));
    
    // Traiter chaque produit
    for (const product of products) {
        await processProduct(product);
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Résumé
    console.log('\n' + '='.repeat(70));
    console.log('📊 RÉSUMÉ FINAL');
    console.log('='.repeat(70));
    console.log(`📝 Produits traités:      ${stats.totalProducts}`);
    console.log(`✅ Produits avec images:  ${stats.productsProcessed}`);
    console.log(`📸 Images uploadées:      ${stats.imagesUploaded}`);
    console.log(`🗑️  Images supprimées:     ${stats.imagesDeleted}`);
    console.log(`⏭️  Produits ignorés:      ${stats.skipped}`);
    console.log(`🔍 Non trouvés:           ${stats.notFound}`);
    console.log(`❌ Erreurs:               ${stats.errors}`);
    console.log('='.repeat(70));
    console.log('\n✅ Correction terminée!');
}

main().catch(console.error);




