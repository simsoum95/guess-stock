#!/usr/bin/env node
/**
 * Script COMPLET pour scraper TOUTES les images VILEBREQUIN depuis GlobalOnline
 * 
 * Ce script :
 * 1. Récupère TOUS les produits VILEBREQUIN depuis Google Sheets
 * 2. Pour chaque produit, identifie TOUTES les variantes de couleur
 * 3. Pour chaque couleur, récupère TOUTES les images (pas juste une)
 * 4. Upload toutes les images dans Supabase Storage
 * 5. Indexe correctement dans image_index avec la bonne couleur
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

// Mapping des codes couleur vers noms lisibles
const COLOR_CODE_MAP = {
    '010': 'BLANC',
    '390': 'BLEU MARINE',
    '990': 'NOIR',
    '399': 'NOIR',
    '300': 'BLEU CIEL',
    '315': 'BLEU',
    '391': 'BLEU NEON',
};

// Stats globales
const stats = {
    totalProducts: 0,
    productsProcessed: 0,
    imagesDownloaded: 0,
    imagesUploaded: 0,
    errors: 0,
    skipped: 0,
};

/**
 * Récupère TOUS les produits VILEBREQUIN depuis image_index
 */
async function getAllVilebrequinProducts() {
    console.log('📋 Récupération des produits VILEBREQUIN depuis image_index...');
    
    // Préfixes typiques des produits VILEBREQUIN
    const vilebrequinPrefixes = [
        'JIMC', 'JIMA', 'JIHI', 'JIIA', 'JOIU', 'BMBA', 'CPPA', 'PYRE', 
        'PLTH', 'CRSH', 'CRSC', 'CRSU', 'FLCC', 'FLEC', 'FLRC', 'FLCH',
        'FLAC', 'BMBA', 'ACKC', 'FLAU', 'MO', 'JI', 'FL', 'AC', 'BM', 'LO', 'MA', 'MT'
    ];
    
    const allModelRefs = new Set();
    
    // Récupérer tous les model_ref qui commencent par ces préfixes
    for (const prefix of vilebrequinPrefixes) {
        const { data, error } = await supabase
            .from('image_index')
            .select('model_ref')
            .ilike('model_ref', `${prefix}%`);
        
        if (data) {
            data.forEach(row => allModelRefs.add(row.model_ref));
        }
    }
    
    // Si aucun produit trouvé dans image_index, essayer de récupérer depuis Google Sheets
    if (allModelRefs.size === 0) {
        console.log('   ⚠️ Aucun produit trouvé dans image_index, tentative Google Sheets...');
        
        const sheetId = process.env.GOOGLE_SHEET_ID;
        const apiKey = process.env.GOOGLE_API_KEY;
        
        if (sheetId && apiKey) {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1?key=${apiKey}`;
            
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    const rows = data.values || [];
                    
                    if (rows.length > 0) {
                        const headers = rows[0].map(h => h?.toString().toLowerCase().trim() || '');
                        const modelRefIdx = headers.findIndex(h => h.includes('model') || h.includes('référence') || h.includes('code'));
                        const brandIdx = headers.findIndex(h => h.includes('marque') || h.includes('brand'));
                        
                        if (modelRefIdx !== -1) {
                            for (let i = 1; i < rows.length; i++) {
                                const row = rows[i];
                                const brand = brandIdx >= 0 ? (row[brandIdx]?.toString().toUpperCase().trim() || '') : '';
                                const modelRef = row[modelRefIdx]?.toString().toUpperCase().trim() || '';
                                
                                if (brand === 'VILEBREQUIN' && modelRef) {
                                    allModelRefs.add(modelRef);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.log('   ⚠️ Erreur Google Sheets:', error.message);
            }
        }
    }
    
    console.log(`   ✅ ${allModelRefs.size} produits uniques trouvés`);
    
    // Convertir en array (on ne connaît pas les couleurs à l'avance, on les scrapera)
    const result = Array.from(allModelRefs).map(modelRef => ({
        modelRef,
        colors: [] // Sera rempli lors du scraping
    }));
    
    return result;
}

/**
 * Scrape toutes les variantes de couleur et leurs images depuis GlobalOnline
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
            if (response.status === 404) {
                return { found: false, colorVariants: [] };
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const colorVariants = new Map();
        
        // 1. Chercher les swatches de couleur et leurs codes dans différents formats
        // Format 1: Swatches Magento standard
        $('.swatch-option, .color, [data-attribute-code="color"], .swatch-attribute-options .swatch-option').each((_, el) => {
            const $el = $(el);
            const colorCode = $el.attr('data-option-id') || $el.attr('data-value') || $el.attr('option-id') || $el.text().trim();
            const colorName = $el.attr('data-option-label') || $el.attr('title') || $el.attr('aria-label') || $el.text().trim();
            
            if (colorCode && colorCode.length <= 10) {
                const normalizedCode = colorCode.toUpperCase();
                let normalizedName = COLOR_CODE_MAP[normalizedCode];
                
                if (!normalizedName) {
                    // Essayer de normaliser le nom de couleur
                    normalizedName = colorName.toUpperCase().trim();
                    // Nettoyer les noms de couleur
                    normalizedName = normalizedName.replace(/[^\w\s]/g, '').trim();
                }
                
                if (normalizedName && normalizedName.length > 0) {
                    if (!colorVariants.has(normalizedName)) {
                        colorVariants.set(normalizedName, {
                            code: normalizedCode,
                            name: normalizedName,
                            images: new Set()
                        });
                    }
                }
            }
        });
        
        // Format 2: Chercher dans les scripts JSON pour les configurations de couleur
        $('script').each((_, el) => {
            const content = $(el).html() || '';
            
            // Chercher les configurations de swatches
            const swatchMatches = content.matchAll(/"swatches":\s*\{[^}]*"options":\s*\{([^}]+)\}/g);
            for (const match of swatchMatches) {
                const optionsJson = match[1];
                const optionMatches = optionsJson.matchAll(/"(\d+)":\s*\{[^}]*"label":\s*"([^"]+)"/g);
                for (const optMatch of optionMatches) {
                    const code = optMatch[1];
                    const label = optMatch[2];
                    const normalizedName = COLOR_CODE_MAP[code] || label.toUpperCase().trim();
                    
                    if (normalizedName && !colorVariants.has(normalizedName)) {
                        colorVariants.set(normalizedName, {
                            code: code,
                            name: normalizedName,
                            images: new Set()
                        });
                    }
                }
            }
        });
        
        // 2. Chercher toutes les images dans la page
        const allImages = new Set();
        
        // Images dans les balises img (toutes les variantes)
        $('img[src*="/media/catalog/product"], img[data-src*="/media/catalog/product"]').each((_, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
            if (src) {
                // Convertir en URL de haute qualité
                if (src.includes('/cache/')) {
                    src = src.replace(/\/cache\/[^/]+\//, '/');
                }
                if (src.startsWith('/')) {
                    src = `https://www.globalonline.co.il${src}`;
                }
                if (src.includes('/media/catalog/product') && 
                    !src.includes('placeholder') && 
                    !src.includes('swatch') &&
                    !src.includes('icon')) {
                    allImages.add(src);
                }
            }
        });
        
        // Images dans les thumbnails de galerie
        $('.fotorama__thumb, .gallery-thumbs img, .product-image-thumbs img').each((_, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-full');
            if (src) {
                if (src.includes('/cache/')) {
                    src = src.replace(/\/cache\/[^/]+\//, '/');
                }
                if (src.startsWith('/')) {
                    src = `https://www.globalonline.co.il${src}`;
                }
                if (src.includes('/media/catalog/product') && 
                    !src.includes('placeholder') && 
                    !src.includes('swatch')) {
                    allImages.add(src);
                }
            }
        });
        
        // 3. Chercher dans les scripts JSON (toutes les variantes)
        $('script').each((_, el) => {
            const content = $(el).html() || '';
            
            // Chercher les configurations de galerie complètes
            // Format: "gallery": { "images": [...] }
            const galleryMatches = content.matchAll(/"gallery":\s*\{[^}]*"images":\s*\[([^\]]+)\]/g);
            for (const match of galleryMatches) {
                const imagesJson = match[1];
                // Chercher toutes les variantes d'images (full, img, thumb, etc.)
                const imgPatterns = [
                    /"full":\s*"([^"]+)"/g,
                    /"img":\s*"([^"]+)"/g,
                    /"thumb":\s*"([^"]+)"/g,
                    /"image":\s*"([^"]+)"/g,
                ];
                
                for (const pattern of imgPatterns) {
                    const imgUrls = imagesJson.matchAll(pattern);
                    for (const imgMatch of imgUrls) {
                        let imgUrl = imgMatch[1].replace(/\\\//g, '/');
                        if (imgUrl.startsWith('/')) {
                            imgUrl = `https://www.globalonline.co.il${imgUrl}`;
                        }
                        if (imgUrl.includes('/media/catalog/product') && 
                            !imgUrl.includes('placeholder') && 
                            !imgUrl.includes('swatch')) {
                            allImages.add(imgUrl);
                        }
                    }
                }
            }
            
            // Chercher les tableaux d'images directement
            const arrayMatches = content.matchAll(/"images":\s*\[([^\]]+)\]/g);
            for (const match of arrayMatches) {
                const imagesArray = match[1];
                const imgUrls = imagesArray.matchAll(/"([^"]*\/media\/catalog\/product[^"]*\.(jpg|jpeg|png|webp))"/gi);
                for (const imgMatch of imgUrls) {
                    let imgUrl = imgMatch[1].replace(/\\\//g, '/');
                    if (imgUrl.startsWith('/')) {
                        imgUrl = `https://www.globalonline.co.il${imgUrl}`;
                    }
                    if (!imgUrl.includes('placeholder') && !imgUrl.includes('swatch')) {
                        allImages.add(imgUrl);
                    }
                }
            }
            
            // Chercher les URLs d'images directement dans tout le contenu
            const directMatches = content.matchAll(/"([^"]*\/media\/catalog\/product[^"]*\.(jpg|jpeg|png|webp))"/gi);
            for (const match of directMatches) {
                let imgUrl = match[1].replace(/\\\//g, '/');
                if (imgUrl.startsWith('/')) {
                    imgUrl = `https://www.globalonline.co.il${imgUrl}`;
                }
                if (!imgUrl.includes('placeholder') && !imgUrl.includes('swatch') && !imgUrl.includes('icon')) {
                    allImages.add(imgUrl);
                }
            }
        });
        
        // 4. Chercher dans les data attributes
        $('[data-gallery], [data-images], [data-mage-init]').each((_, el) => {
            const $el = $(el);
            const dataGallery = $el.attr('data-gallery');
            const dataImages = $el.attr('data-images');
            const dataMageInit = $el.attr('data-mage-init');
            
            for (const dataAttr of [dataGallery, dataImages, dataMageInit]) {
                if (dataAttr) {
                    try {
                        const parsed = JSON.parse(dataAttr);
                        const images = parsed.images || parsed.gallery?.images || [];
                        for (const img of images) {
                            let imgUrl = img.full || img.img || img.thumb || img;
                            if (typeof imgUrl === 'string') {
                                imgUrl = imgUrl.replace(/\\\//g, '/');
                                if (imgUrl.startsWith('/')) {
                                    imgUrl = `https://www.globalonline.co.il${imgUrl}`;
                                }
                                if (imgUrl.includes('/media/catalog/product') && 
                                    !imgUrl.includes('placeholder') && 
                                    !imgUrl.includes('swatch')) {
                                    allImages.add(imgUrl);
                                }
                            }
                        }
                    } catch (e) {
                        // Ignorer les erreurs de parsing
                    }
                }
            }
        });
        
        // 4. Grouper les images par couleur en utilisant le nom de fichier
        const imagesByColor = new Map();
        
        for (const imgUrl of allImages) {
            const filename = imgUrl.split('/').pop();
            const filenameParts = filename.replace(/\.[^.]+$/, '').split(/[_-]/);
            
            // Chercher le code couleur dans le nom de fichier
            // Format: modelref_colorcode_1_1.jpg ou modelref_colorcode_1.jpg
            let colorCode = null;
            let colorName = 'DEFAULT';
            
            // Essayer de trouver le code couleur (généralement le 2ème segment)
            if (filenameParts.length >= 2) {
                const potentialCode = filenameParts[1];
                // Vérifier si c'est un code couleur (3 chiffres) ou un nom de couleur
                if (potentialCode && potentialCode.length <= 10) {
                    if (/^\d{3}$/.test(potentialCode)) {
                        // C'est un code couleur numérique (010, 390, 990, etc.)
                        colorCode = potentialCode;
                        colorName = COLOR_CODE_MAP[colorCode] || colorCode;
                    } else if (/^[A-Z]{2,}$/i.test(potentialCode)) {
                        // C'est un nom de couleur (BLEU, ROSE, etc.)
                        colorName = potentialCode.toUpperCase();
                    } else {
                        // Essayer de mapper
                        colorCode = potentialCode.toUpperCase();
                        colorName = COLOR_CODE_MAP[colorCode] || potentialCode.toUpperCase();
                    }
                }
            }
            
            // Si on n'a pas trouvé de couleur, essayer d'autres segments
            if (colorName === 'DEFAULT' && filenameParts.length >= 3) {
                for (let i = 2; i < filenameParts.length; i++) {
                    const part = filenameParts[i];
                    if (/^\d{3}$/.test(part)) {
                        colorCode = part;
                        colorName = COLOR_CODE_MAP[colorCode] || colorCode;
                        break;
                    }
                }
            }
            
            // Si toujours pas de couleur, utiliser DEFAULT mais regrouper toutes les images
            if (!imagesByColor.has(colorName)) {
                imagesByColor.set(colorName, new Set());
            }
            imagesByColor.get(colorName).add(imgUrl);
        }
        
        // 5. Si on a trouvé des images mais pas de variantes de couleur, créer des variantes depuis les images
        if (imagesByColor.size > 0 && colorVariants.size === 0) {
            // Créer des variantes depuis les images groupées par couleur
            for (const [colorName, images] of imagesByColor.entries()) {
                colorVariants.set(colorName, {
                    code: colorName,
                    name: colorName,
                    images: images
                });
            }
        } else {
            // Merger avec les variantes de couleur trouvées
            for (const [colorName, variant] of colorVariants.entries()) {
                if (imagesByColor.has(colorName)) {
                    // Merger les images
                    for (const img of imagesByColor.get(colorName)) {
                        variant.images.add(img);
                    }
                }
            }
            
            // Ajouter les couleurs trouvées uniquement via les images
            for (const [colorName, images] of imagesByColor.entries()) {
                if (!colorVariants.has(colorName)) {
                    colorVariants.set(colorName, {
                        code: colorName,
                        name: colorName,
                        images: images
                    });
                }
            }
        }
        
        // 6. Si on n'a toujours pas de variantes mais qu'on a des images, créer une variante DEFAULT
        if (colorVariants.size === 0 && allImages.size > 0) {
            // Essayer de regrouper toutes les images par code couleur dans le nom de fichier
            const imagesByCode = new Map();
            
            for (const imgUrl of allImages) {
                const filename = imgUrl.split('/').pop();
                const filenameParts = filename.replace(/\.[^.]+$/, '').split(/[_-]/);
                
                // Chercher un code couleur (3 chiffres)
                let foundColor = 'DEFAULT';
                for (const part of filenameParts) {
                    if (/^\d{3}$/.test(part)) {
                        foundColor = COLOR_CODE_MAP[part] || part;
                        break;
                    }
                }
                
                if (!imagesByCode.has(foundColor)) {
                    imagesByCode.set(foundColor, new Set());
                }
                imagesByCode.get(foundColor).add(imgUrl);
            }
            
            // Créer des variantes depuis les images groupées
            for (const [colorName, images] of imagesByCode.entries()) {
                colorVariants.set(colorName, {
                    code: colorName,
                    name: colorName,
                    images: images
                });
            }
        }
        
        // Convertir en format de retour
        const result = [];
        for (const [colorName, variant] of colorVariants.entries()) {
            if (variant.images && variant.images.size > 0) {
                result.push({
                    color: colorName,
                    code: variant.code,
                    images: Array.from(variant.images)
                });
            }
        }
        
        return { found: true, colorVariants: result };
    } catch (error) {
        return { found: false, colorVariants: [], error: error.message };
    }
}

/**
 * Télécharge et upload une image
 */
async function downloadAndUploadImage(imageUrl, modelRef, color, index) {
    try {
        // Télécharger l'image
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Vérifier que l'image n'est pas vide (taille minimale)
        if (buffer.length < 1000) {
            throw new Error('Image trop petite (probablement vide)');
        }
        
        // Créer le nom de fichier
        const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)$/i)?.[1] || 'jpg';
        const filename = `${modelRef}_${color.replace(/\s+/g, '_')}_${index}.${ext}`.toUpperCase();
        
        // Vérifier si l'image existe déjà
        const { data: existing } = await supabase
            .from('image_index')
            .select('id')
            .eq('filename', filename)
            .single();
        
        if (existing) {
            return { success: false, reason: 'exists', filename };
        }
        
        // Uploader sur Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('guess-images')
            .upload(filename, buffer, {
                contentType: `image/${ext}`,
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
        
        stats.imagesDownloaded++;
        stats.imagesUploaded++;
        
        return { success: true, filename, url: publicUrl };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

/**
 * Traite un produit complet
 */
async function processProduct(product) {
    stats.totalProducts++;
    const { modelRef, colors: expectedColors } = product;
    
    console.log(`\n🔍 Traitement ${modelRef}...`);
    
    // Scraper toutes les variantes de couleur
    const { found, colorVariants, error } = await scrapeAllColorVariants(modelRef);
    
    if (!found) {
        if (error) {
            console.log(`   ❌ Erreur: ${error}`);
            stats.errors++;
        } else {
            console.log(`   ⚠️ Produit non trouvé sur GlobalOnline`);
            stats.skipped++;
        }
        return;
    }
    
    if (colorVariants.length === 0) {
        console.log(`   ⚠️ Aucune variante de couleur trouvée`);
        stats.skipped++;
        return;
    }
    
    console.log(`   📸 ${colorVariants.length} variantes de couleur trouvées`);
    
    let totalUploaded = 0;
    
    // Traiter chaque variante de couleur
    for (const variant of colorVariants) {
        const { color, images } = variant;
        
        console.log(`   🎨 Couleur: ${color} (${images.length} images)`);
        
        // Uploader toutes les images pour cette couleur
        for (let i = 0; i < images.length; i++) {
            const result = await downloadAndUploadImage(images[i], modelRef, color, i + 1);
            
            if (result.success) {
                totalUploaded++;
                console.log(`      ✅ ${result.filename}`);
            } else if (result.reason === 'exists') {
                // Image existe déjà, on continue
            } else {
                console.log(`      ❌ Échec: ${result.reason}`);
            }
            
            // Petite pause pour éviter de surcharger
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    if (totalUploaded > 0) {
        stats.productsProcessed++;
        console.log(`   ✅ ${totalUploaded} nouvelles images ajoutées pour ${modelRef}`);
    } else {
        console.log(`   ⏭️  Toutes les images existent déjà`);
    }
}

/**
 * Fonction principale
 */
async function main() {
    console.log('🚀 Démarrage du scraping COMPLET GlobalOnline pour VILEBREQUIN');
    console.log('='.repeat(60));
    
    // Récupérer tous les produits VILEBREQUIN
    const products = await getAllVilebrequinProducts();
    
    if (products.length === 0) {
        console.log('⚠️ Aucun produit VILEBREQUIN trouvé');
        return;
    }
    
    console.log(`\n📊 Total: ${products.length} produits à traiter`);
    console.log('='.repeat(60));
    
    // Filtrer pour tester un produit spécifique si fourni en argument
    const testProduct = process.argv.find(arg => arg.startsWith('--test='))?.split('=')[1];
    let productsToProcess = products;
    
    if (testProduct) {
        productsToProcess = products.filter(p => p.modelRef === testProduct.toUpperCase());
        if (productsToProcess.length === 0) {
            console.log(`⚠️ Produit ${testProduct} non trouvé, traitement de tous les produits`);
            productsToProcess = products;
        } else {
            console.log(`🧪 Mode test: traitement uniquement de ${testProduct}`);
        }
    }
    
    // Traiter chaque produit
    for (let i = 0; i < productsToProcess.length; i++) {
        const product = productsToProcess[i];
        
        // Afficher la progression
        if (i % 10 === 0 && i > 0) {
            console.log(`\n📈 Progression: ${i}/${productsToProcess.length} (${Math.round(i/productsToProcess.length*100)}%)`);
        }
        
        await processProduct(product);
        
        // Pause entre chaque produit
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Résumé final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`📝 Produits traités:      ${stats.totalProducts}`);
    console.log(`✅ Produits avec images:  ${stats.productsProcessed}`);
    console.log(`📸 Images téléchargées:   ${stats.imagesDownloaded}`);
    console.log(`📤 Images uploadées:      ${stats.imagesUploaded}`);
    console.log(`⏭️  Produits ignorés:      ${stats.skipped}`);
    console.log(`❌ Erreurs:               ${stats.errors}`);
    console.log('='.repeat(60));
    console.log('\n✅ Scraping terminé!');
}

main().catch(console.error);

