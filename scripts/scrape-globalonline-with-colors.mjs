#!/usr/bin/env node
/**
 * Script pour scraper les images de GlobalOnline pour VILEBREQUIN et SAM EDELMAN
 * AVEC gestion des couleurs du Google Sheet
 * 
 * Ce script :
 * 1. Récupère les produits + couleurs depuis Google Sheets
 * 2. Pour chaque produit, va sur GlobalOnline et récupère TOUTES les variantes de couleur
 * 3. Match les couleurs entre Google Sheet et GlobalOnline
 * 4. Télécharge et uploade les bonnes images
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement depuis .env.local
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

// Configuration Google Sheets
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const GOOGLE_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

// Mapping des couleurs GlobalOnline vers couleurs standard
const COLOR_MAPPING = {
    // Français/Anglais vers code couleur
    'BLANC': ['WHITE', 'BIANCO', 'WH', 'WHT', 'BLA', 'BLANC'],
    'BLEU': ['BLUE', 'BLU', 'NAVY', 'MARINE', 'NVY', 'BLEU'],
    'NOIR': ['BLACK', 'BLK', 'NERO', 'NR', 'NOIR'],
    'ROUGE': ['RED', 'ROSSO', 'RD', 'ROUGE'],
    'BEIGE': ['BEIGE', 'SAND', 'TAN', 'SABBIA', 'SABLE', 'BGE'],
    'VERT': ['GREEN', 'VERDE', 'GRN', 'VERT'],
    'JAUNE': ['YELLOW', 'GIALLO', 'YLW', 'JAUNE'],
    'ORANGE': ['ORANGE', 'ARANCIO', 'ORG'],
    'ROSE': ['PINK', 'ROSA', 'PNK', 'ROSE'],
    'VIOLET': ['PURPLE', 'VIOLA', 'MAUVE', 'PRP', 'VIOLET'],
    'MARRON': ['BROWN', 'MARRONE', 'BRN', 'MARRON', 'COG', 'COGNAC'],
    'GRIS': ['GRAY', 'GREY', 'GRIGIO', 'GRY', 'GRIS'],
    'MULTI': ['MULTI', 'MULTICOLOR', 'MULTICOLORE'],
};

// Stats globales
const stats = {
    totalProducts: 0,
    productsWithNewImages: 0,
    imagesDownloaded: 0,
    imagesUploaded: 0,
    errors: 0,
    skipped: 0,
    notFound: 0,
    colorMatched: 0,
    colorNotMatched: 0
};

/**
 * Récupère les produits VILEBREQUIN et SAM EDELMAN depuis Google Sheets
 */
async function getProductsFromGoogleSheet() {
    console.log('📋 Récupération des produits depuis Google Sheets...');
    
    if (!GOOGLE_CREDENTIALS || !SPREADSHEET_ID) {
        console.error('❌ Credentials Google manquantes');
        return [];
    }
    
    try {
        const credentials = JSON.parse(GOOGLE_CREDENTIALS);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        
        const sheets = google.sheets({ version: 'v4', auth });
        
        // Lire les onglets VILEBREQUIN et SAM EDELMAN
        const sheetNames = ['VILEBREQUIN', 'נעליים SAM'];
        const products = [];
        
        for (const sheetName of sheetNames) {
            try {
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `'${sheetName}'!A:Z`,
                });
                
                const rows = response.data.values;
                if (!rows || rows.length < 2) continue;
                
                const headers = rows[0];
                const colorColIndex = headers.findIndex(h => 
                    h && (h.includes('צבע') || h.toLowerCase() === 'color')
                );
                const itemCodeColIndex = headers.findIndex(h => 
                    h && (h.includes('קוד פריט') || h.toLowerCase() === 'itemcode')
                );
                
                console.log(`   📄 ${sheetName}: ${rows.length - 1} lignes, colorCol=${colorColIndex}, itemCodeCol=${itemCodeColIndex}`);
                
                if (colorColIndex === -1 || itemCodeColIndex === -1) {
                    console.warn(`   ⚠️ Colonnes manquantes dans ${sheetName}`);
                    continue;
                }
                
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const itemCode = row[itemCodeColIndex]?.toString().trim();
                    const color = row[colorColIndex]?.toString().trim();
                    
                    if (!itemCode) continue;
                    
                    // Extraire le modelRef du itemCode
                    // Ex: PYRE9000-315-OS -> PYRE9000, couleur 315
                    // Ex: HBSE-125-0011-BLACK-OS -> HBSE-125-0011, couleur BLACK
                    const parts = itemCode.split('-');
                    let modelRef, colorCode;
                    
                    const brand = sheetName.includes('SAM') ? 'SAM EDELMAN' : 'VILEBREQUIN';
                    
                    if (brand === 'SAM EDELMAN' && parts.length >= 4) {
                        modelRef = `${parts[0]}-${parts[1]}-${parts[2]}`;
                        colorCode = parts[3];
                    } else if (parts.length >= 2) {
                        modelRef = parts[0];
                        colorCode = parts[1];
                    } else {
                        modelRef = itemCode;
                        colorCode = color;
                    }
                    
                    products.push({
                        modelRef: modelRef.toUpperCase(),
                        color: color?.toUpperCase() || '',
                        colorCode: colorCode?.toUpperCase() || '',
                        itemCode: itemCode.toUpperCase(),
                        brand
                    });
                }
            } catch (err) {
                console.warn(`   ⚠️ Erreur lecture ${sheetName}:`, err.message);
            }
        }
        
        // Dédupliquer par modelRef + colorCode
        const uniqueProducts = new Map();
        for (const p of products) {
            const key = `${p.modelRef}_${p.colorCode || p.color}`;
            if (!uniqueProducts.has(key)) {
                uniqueProducts.set(key, p);
            }
        }
        
        console.log(`   ✅ ${uniqueProducts.size} produits uniques trouvés`);
        return Array.from(uniqueProducts.values());
    } catch (error) {
        console.error('❌ Erreur Google Sheets:', error.message);
        return [];
    }
}

/**
 * Scrape TOUTES les variantes de couleur d'un produit sur GlobalOnline
 */
async function scrapeAllColorVariants(modelRef) {
    const url = `https://www.globalonline.co.il/${modelRef.toLowerCase()}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
            },
        });
        
        if (!response.ok) {
            return { found: false, colorVariants: {} };
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const colorVariants = {};
        
        // 1. Chercher les swatches de couleur avec leurs images associées
        // Structure typique: <div class="swatch-option color" data-option-label="315" data-thumb-url="...">
        $('[data-option-label]').each((_, el) => {
            const colorLabel = $(el).attr('data-option-label');
            const thumbUrl = $(el).attr('data-thumb-url') || $(el).attr('data-option-tooltip-thumb');
            
            if (colorLabel && thumbUrl && thumbUrl.includes('/media/catalog/product')) {
                if (!colorVariants[colorLabel]) {
                    colorVariants[colorLabel] = [];
                }
                // Convertir thumb en image haute qualité
                let fullUrl = thumbUrl.replace(/\/cache\/[^/]+\//, '/');
                if (fullUrl.startsWith('/')) fullUrl = `https://www.globalonline.co.il${fullUrl}`;
                colorVariants[colorLabel].push(fullUrl);
            }
        });
        
        // 2. Chercher dans le JSON de configuration du produit
        $('script').each((_, el) => {
            const content = $(el).html() || '';
            
            // Chercher la configuration du produit (jsonConfig)
            if (content.includes('jsonConfig') || content.includes('spConfig')) {
                // Essayer d'extraire le mapping couleur -> images
                const colorImageMatches = content.matchAll(/"(\d{3})"\s*:\s*\{[^}]*"images"\s*:\s*\[([^\]]+)\]/g);
                for (const match of colorImageMatches) {
                    const colorCode = match[1];
                    const imagesStr = match[2];
                    
                    // Extraire les URLs d'images
                    const imgUrls = imagesStr.matchAll(/"(?:full|img|large)"\s*:\s*"([^"]+)"/g);
                    for (const imgMatch of imgUrls) {
                        let imgUrl = imgMatch[1].replace(/\\\//g, '/');
                        if (imgUrl.includes('/media/catalog/product')) {
                            if (imgUrl.startsWith('/')) imgUrl = `https://www.globalonline.co.il${imgUrl}`;
                            if (!colorVariants[colorCode]) {
                                colorVariants[colorCode] = [];
                            }
                            if (!colorVariants[colorCode].includes(imgUrl)) {
                                colorVariants[colorCode].push(imgUrl);
                            }
                        }
                    }
                }
                
                // Alternative: chercher la structure "optionId" -> images
                const optionMatches = content.matchAll(/"optionId"\s*:\s*"?(\w+)"?[^}]*"images"\s*:\s*(\[[^\]]+\])/g);
                for (const match of optionMatches) {
                    const optionId = match[1];
                    try {
                        const images = JSON.parse(match[2].replace(/'/g, '"'));
                        for (const img of images) {
                            if (img.full || img.img) {
                                let imgUrl = (img.full || img.img).replace(/\\\//g, '/');
                                if (imgUrl.startsWith('/')) imgUrl = `https://www.globalonline.co.il${imgUrl}`;
                                if (!colorVariants[optionId]) {
                                    colorVariants[optionId] = [];
                                }
                                if (!colorVariants[optionId].includes(imgUrl)) {
                                    colorVariants[optionId].push(imgUrl);
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
        });
        
        // 3. Fallback: récupérer toutes les images et essayer de déduire la couleur du nom de fichier
        if (Object.keys(colorVariants).length === 0) {
            const allImages = [];
            $('img[src*="/media/catalog/product"]').each((_, el) => {
                let src = $(el).attr('src');
                if (src && !src.includes('placeholder') && !src.includes('swatch')) {
                    src = src.replace(/\/cache\/[^/]+\//, '/');
                    if (src.startsWith('/')) src = `https://www.globalonline.co.il${src}`;
                    allImages.push(src);
                }
            });
            
            // Extraire la couleur du nom de fichier
            // Ex: pyre9000_315_1_1.jpg -> couleur 315
            for (const imgUrl of allImages) {
                const filename = imgUrl.split('/').pop();
                const parts = filename.replace(/\.[^.]+$/, '').split(/[_-]/);
                if (parts.length >= 2) {
                    const potentialColor = parts[1].toUpperCase();
                    if (!colorVariants[potentialColor]) {
                        colorVariants[potentialColor] = [];
                    }
                    if (!colorVariants[potentialColor].includes(imgUrl)) {
                        colorVariants[potentialColor].push(imgUrl);
                    }
                }
            }
        }
        
        return { found: true, colorVariants };
    } catch (error) {
        return { found: false, colorVariants: {}, error: error.message };
    }
}

/**
 * Trouve la meilleure correspondance de couleur
 */
function matchColor(sheetColor, sheetColorCode, availableColors) {
    const availableKeys = Object.keys(availableColors);
    
    // 1. Match exact avec le code couleur
    if (sheetColorCode && availableKeys.includes(sheetColorCode)) {
        return sheetColorCode;
    }
    
    // 2. Match exact avec le nom de couleur (normalisé)
    const normalizedSheetColor = sheetColor?.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    for (const key of availableKeys) {
        if (key.toUpperCase() === normalizedSheetColor) {
            return key;
        }
    }
    
    // 3. Match via le mapping de couleurs
    for (const [standardColor, aliases] of Object.entries(COLOR_MAPPING)) {
        const sheetMatches = aliases.some(a => 
            normalizedSheetColor?.includes(a) || sheetColorCode?.includes(a)
        );
        
        if (sheetMatches) {
            // Chercher une couleur disponible qui correspond
            for (const key of availableKeys) {
                const keyUpper = key.toUpperCase();
                if (aliases.some(a => keyUpper.includes(a) || a.includes(keyUpper))) {
                    return key;
                }
            }
        }
    }
    
    // 4. Match partiel
    for (const key of availableKeys) {
        if (normalizedSheetColor && key.toUpperCase().includes(normalizedSheetColor.slice(0, 3))) {
            return key;
        }
        if (sheetColorCode && key.toUpperCase().includes(sheetColorCode.slice(0, 3))) {
            return key;
        }
    }
    
    return null;
}

/**
 * Télécharge une image et l'uploade sur Supabase
 */
async function downloadAndUploadImage(imageUrl, modelRef, color, index) {
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
        const filename = `${modelRef}_${color}_${index}${ext}`.toUpperCase();
        const storagePath = filename;
        
        // Vérifier si l'image existe déjà
        const { data: existingImage } = await supabase
            .from('image_index')
            .select('id')
            .eq('filename', filename)
            .single();
        
        if (existingImage) {
            return { success: false, reason: 'exists', filename };
        }
        
        // Uploader sur Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('guess-images')
            .upload(storagePath, buffer, {
                contentType: `image/${ext.slice(1)}`,
                upsert: true
            });
        
        if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
        }
        
        // Obtenir l'URL publique
        const { data: { publicUrl } } = supabase.storage
            .from('guess-images')
            .getPublicUrl(storagePath);
        
        // Indexer dans image_index
        const { error: indexError } = await supabase
            .from('image_index')
            .upsert({
                model_ref: modelRef.toUpperCase(),
                color: color.toUpperCase(),
                filename: filename,
                url: publicUrl,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'filename'
            });
        
        if (indexError) {
            console.warn(`   ⚠️ Indexation échouée pour ${filename}:`, indexError.message);
        }
        
        return { success: true, filename, url: publicUrl };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

/**
 * Traite un produit
 */
async function processProduct(product) {
    stats.totalProducts++;
    
    const { modelRef, color, colorCode, brand } = product;
    
    // Vérifier si on a déjà des images pour ce produit + couleur
    const { count: existingCount } = await supabase
        .from('image_index')
        .select('*', { count: 'exact', head: true })
        .eq('model_ref', modelRef)
        .eq('color', colorCode || color);
    
    if (existingCount && existingCount >= 2) {
        stats.skipped++;
        return;
    }
    
    console.log(`\n🔍 ${modelRef} - Couleur: ${color} (code: ${colorCode})`);
    
    // Scraper toutes les variantes de couleur
    const { found, colorVariants, error } = await scrapeAllColorVariants(modelRef);
    
    if (!found) {
        console.log(`   ⚠️ Produit non trouvé sur GlobalOnline`);
        stats.notFound++;
        return;
    }
    
    const availableColors = Object.keys(colorVariants);
    console.log(`   📸 Couleurs disponibles: ${availableColors.join(', ') || 'aucune'}`);
    
    // Trouver la bonne couleur
    const matchedColor = matchColor(color, colorCode, colorVariants);
    
    if (!matchedColor) {
        console.log(`   ❌ Pas de correspondance pour couleur "${color}" / "${colorCode}"`);
        stats.colorNotMatched++;
        
        // Si une seule couleur disponible, l'utiliser quand même
        if (availableColors.length === 1) {
            const onlyColor = availableColors[0];
            console.log(`   ℹ️ Utilisation de la seule couleur disponible: ${onlyColor}`);
            const images = colorVariants[onlyColor];
            await uploadImages(images, modelRef, colorCode || color);
        }
        return;
    }
    
    console.log(`   ✅ Couleur matchée: "${matchedColor}"`);
    stats.colorMatched++;
    
    const images = colorVariants[matchedColor];
    await uploadImages(images, modelRef, colorCode || color);
}

async function uploadImages(images, modelRef, color) {
    if (!images || images.length === 0) {
        console.log(`   ⚠️ Aucune image pour cette couleur`);
        return;
    }
    
    console.log(`   📸 ${images.length} images à télécharger`);
    
    let uploadedCount = 0;
    for (let i = 0; i < Math.min(images.length, 5); i++) { // Max 5 images par couleur
        const result = await downloadAndUploadImage(images[i], modelRef, color, i + 1);
        
        if (result.success) {
            uploadedCount++;
            stats.imagesUploaded++;
            console.log(`   ✅ ${result.filename}`);
        } else if (result.reason !== 'exists') {
            console.log(`   ❌ Échec: ${result.reason}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    if (uploadedCount > 0) {
        stats.productsWithNewImages++;
    }
}

/**
 * Fonction principale
 */
async function main() {
    console.log('🚀 Scraping GlobalOnline AVEC gestion des couleurs');
    console.log('='.repeat(60));
    
    // Récupérer les produits depuis Google Sheets
    const products = await getProductsFromGoogleSheet();
    
    if (products.length === 0) {
        console.log('❌ Aucun produit trouvé dans Google Sheets');
        return;
    }
    
    console.log(`\n📊 ${products.length} produits à traiter`);
    console.log('='.repeat(60));
    
    // Traiter chaque produit
    for (let i = 0; i < products.length; i++) {
        if (i % 20 === 0 && i > 0) {
            console.log(`\n📈 Progression: ${i}/${products.length} (${Math.round(i/products.length*100)}%)`);
        }
        
        await processProduct(products[i]);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`📝 Produits traités:      ${stats.totalProducts}`);
    console.log(`✅ Avec nouvelles images: ${stats.productsWithNewImages}`);
    console.log(`📸 Images uploadées:      ${stats.imagesUploaded}`);
    console.log(`🎨 Couleurs matchées:     ${stats.colorMatched}`);
    console.log(`❌ Couleurs non matchées: ${stats.colorNotMatched}`);
    console.log(`⏭️  Ignorés:              ${stats.skipped}`);
    console.log(`🔍 Non trouvés:           ${stats.notFound}`);
    console.log('='.repeat(60));
    console.log('\n✅ Terminé!');
}

main().catch(console.error);

