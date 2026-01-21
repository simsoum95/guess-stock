#!/usr/bin/env node
/**
 * Script pour scraper les images de GlobalOnline en utilisant les codes du Google Sheet
 * 
 * Stratégie:
 * 1. Récupère tous les itemCode/modelRef depuis le Google Sheet
 * 2. Pour chaque code, essaie d'accéder à la page produit sur globalonline.co.il
 * 3. Scrape les images de la page
 * 4. Upload vers Supabase Storage
 * 
 * Usage: node scripts/scrape-from-sheet-codes.mjs
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables Supabase manquantes');
    process.exit(1);
}

if (!GOOGLE_SHEET_ID || !GOOGLE_API_KEY) {
    console.error('❌ Variables Google Sheet manquantes');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const stats = {
    totalCodes: 0,
    productsFound: 0,
    productsNotFound: 0,
    imagesUploaded: 0,
    imagesSkipped: 0,
    errors: 0,
};

/**
 * Récupère tous les codes produits depuis le Google Sheet
 */
async function getProductCodesFromSheet() {
    console.log('📋 Récupération des codes depuis Google Sheet...');
    
    const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${GOOGLE_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Google Sheets API error: ${response.status}`);
    }
    
    const data = await response.json();
    const rows = data.values || [];
    
    if (rows.length === 0) {
        throw new Error('Google Sheet est vide');
    }
    
    // Trouver les colonnes itemCode (G) et modelRef (D)
    const headers = rows[0];
    console.log('   Headers:', headers.slice(0, 10).join(', '));
    
    const codes = new Set();
    
    // Colonnes typiques: D = modelRef (index 3), G = itemCode (index 6)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        // itemCode (colonne G, index 6)
        const itemCode = (row[6] || '').toString().trim();
        if (itemCode && itemCode.length >= 4) {
            codes.add(itemCode.toUpperCase());
        }
        
        // modelRef (colonne D, index 3) 
        const modelRef = (row[3] || '').toString().trim();
        if (modelRef && modelRef.length >= 4 && modelRef !== itemCode) {
            codes.add(modelRef.toUpperCase());
        }
    }
    
    console.log(`   ✅ ${codes.size} codes uniques trouvés`);
    return Array.from(codes);
}

/**
 * Génère les URLs possibles pour un code produit
 */
function generateProductUrls(code) {
    const urls = [];
    const codeLower = code.toLowerCase();
    
    // URL directe avec le code
    urls.push(`https://www.globalonline.co.il/${codeLower}.html`);
    urls.push(`https://www.globalonline.co.il/${codeLower}`);
    
    // Avec tirets pour les codes style "BG699433"
    if (code.match(/^[A-Z]{2}\d{6}$/i)) {
        // Format: bg-699433
        const formatted = `${code.slice(0, 2)}-${code.slice(2)}`.toLowerCase();
        urls.push(`https://www.globalonline.co.il/${formatted}.html`);
    }
    
    return urls;
}

/**
 * Scrape les images d'une page produit
 */
async function scrapeProductImages(productUrl) {
    try {
        const response = await fetch(productUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            redirect: 'follow',
        });
        
        if (!response.ok) {
            return { found: false, images: [] };
        }
        
        // Vérifier si c'est une vraie page produit (pas une redirection vers la home)
        const finalUrl = response.url;
        if (finalUrl === 'https://www.globalonline.co.il/' || 
            finalUrl.includes('/catalogsearch/') ||
            finalUrl.includes('?')) {
            return { found: false, images: [] };
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        // Vérifier qu'on est bien sur une page produit
        const hasProductTitle = $('h1.page-title, .product-info-main h1').length > 0;
        if (!hasProductTitle) {
            return { found: false, images: [] };
        }
        
        const images = new Set();
        
        // 1. Images de galerie
        $('img[src*="/media/catalog/product"]').each((_, el) => {
            let src = $(el).attr('src');
            if (src && !src.includes('placeholder') && !src.includes('swatch')) {
                if (src.includes('/cache/')) {
                    src = src.replace(/\/cache\/[^/]+\//, '/');
                }
                if (src.startsWith('/')) src = `https://www.globalonline.co.il${src}`;
                images.add(src);
            }
        });
        
        // 2. Data-src (lazy loading)
        $('img[data-src*="/media/catalog/product"]').each((_, el) => {
            let src = $(el).attr('data-src');
            if (src && !src.includes('placeholder') && !src.includes('swatch')) {
                if (src.includes('/cache/')) {
                    src = src.replace(/\/cache\/[^/]+\//, '/');
                }
                if (src.startsWith('/')) src = `https://www.globalonline.co.il${src}`;
                images.add(src);
            }
        });
        
        // 3. Scripts JSON
        $('script').each((_, el) => {
            const content = $(el).html() || '';
            const imgMatches = content.matchAll(/"(?:img|full|thumb|image)":\s*"([^"]+media\/catalog\/product[^"]+)"/g);
            for (const match of imgMatches) {
                let imgUrl = match[1].replace(/\\\//g, '/');
                if (imgUrl.startsWith('/')) imgUrl = `https://www.globalonline.co.il${imgUrl}`;
                images.add(imgUrl);
            }
        });
        
        // 4. Data attributes
        $('[data-mage-init]').each((_, el) => {
            const data = $(el).attr('data-mage-init');
            if (data) {
                const imgMatches = data.matchAll(/"(?:img|full|thumb)":\s*"([^"]+)"/g);
                for (const match of imgMatches) {
                    let imgUrl = match[1].replace(/\\\//g, '/');
                    if (imgUrl.includes('/media/catalog/product')) {
                        if (imgUrl.startsWith('/')) imgUrl = `https://www.globalonline.co.il${imgUrl}`;
                        images.add(imgUrl);
                    }
                }
            }
        });
        
        // Extraire infos produit
        const pageTitle = $('h1.page-title span, h1.product-name').text().trim();
        const skuEl = $('.product-info-stock-sku .value, [itemprop="sku"]').text().trim();
        
        // Filtrer les images
        const cleanImages = Array.from(images).filter(url => {
            return url && 
                   url.includes('/media/catalog/product') && 
                   !url.includes('placeholder') &&
                   !url.includes('/swatch/') &&
                   (url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png') || url.endsWith('.webp'));
        });
        
        // Dédupliquer par nom de fichier
        const uniqueByFilename = new Map();
        for (const url of cleanImages) {
            const filename = url.split('/').pop();
            if (!uniqueByFilename.has(filename)) {
                uniqueByFilename.set(filename, url);
            }
        }
        
        return { 
            found: true, 
            images: Array.from(uniqueByFilename.values()),
            pageTitle,
            pageSku: skuEl,
            finalUrl: response.url
        };
    } catch (error) {
        return { found: false, images: [], error: error.message };
    }
}

/**
 * Télécharge et uploade une image
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
        
        const originalFilename = imageUrl.split('/').pop();
        
        // Extraire couleur du nom de fichier si pas fournie
        if (!color) {
            const parts = originalFilename.replace(/\.[^.]+$/, '').split(/[_-]/);
            if (parts.length >= 2 && parts[1].length <= 10) {
                color = parts[1].toUpperCase();
            }
        }
        if (!color) color = 'DEFAULT';
        
        const ext = path.extname(originalFilename) || '.jpg';
        const filename = `${modelRef}_${color}_${index}${ext}`.toUpperCase().replace(/[^A-Z0-9._-]/g, '_');
        const storagePath = `products/${filename}`;
        
        // Vérifier si existe
        const { data: existing } = await supabase
            .from('image_index')
            .select('id')
            .eq('filename', filename)
            .single();
        
        if (existing) {
            return { success: false, reason: 'exists' };
        }
        
        // Upload
        const { error: uploadError } = await supabase.storage
            .from('guess-images')
            .upload(storagePath, buffer, {
                contentType: `image/${ext.slice(1)}`,
                upsert: true
            });
        
        if (uploadError && !uploadError.message.includes('already exists')) {
            throw new Error(uploadError.message);
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('guess-images')
            .getPublicUrl(storagePath);
        
        // Index
        await supabase.from('image_index').upsert({
            model_ref: modelRef.toUpperCase(),
            color: color,
            filename: filename,
            url: publicUrl,
            created_at: new Date().toISOString()
        }, { onConflict: 'filename' });
        
        return { success: true, filename };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

/**
 * Traite un code produit
 */
async function processCode(code) {
    stats.totalCodes++;
    
    // Vérifier si on a déjà des images
    const { count: existingCount } = await supabase
        .from('image_index')
        .select('*', { count: 'exact', head: true })
        .eq('model_ref', code);
    
    if (existingCount >= 2) {
        stats.imagesSkipped++;
        return;
    }
    
    console.log(`\n🔍 [${stats.totalCodes}] ${code} (${existingCount || 0} images)`);
    
    // Essayer plusieurs URLs
    const urls = generateProductUrls(code);
    let result = null;
    
    for (const url of urls) {
        result = await scrapeProductImages(url);
        if (result.found && result.images.length > 0) {
            console.log(`   ✅ Trouvé sur: ${url}`);
            break;
        }
    }
    
    if (!result || !result.found || result.images.length === 0) {
        stats.productsNotFound++;
        console.log(`   ⚠️ Non trouvé sur GlobalOnline`);
        return;
    }
    
    stats.productsFound++;
    console.log(`   📸 ${result.images.length} images trouvées`);
    
    // Upload images
    let uploaded = 0;
    for (let i = 0; i < result.images.length && i < 10; i++) {
        const uploadResult = await downloadAndUploadImage(result.images[i], code, '', i + 1);
        if (uploadResult.success) {
            uploaded++;
            stats.imagesUploaded++;
            console.log(`   ✅ ${uploadResult.filename}`);
        }
        await new Promise(r => setTimeout(r, 300));
    }
}

/**
 * Main
 */
async function main() {
    console.log('🚀 Scraping GlobalOnline via codes Google Sheet');
    console.log('='.repeat(60));
    
    try {
        const codes = await getProductCodesFromSheet();
        
        console.log(`\n📊 ${codes.length} codes à traiter`);
        console.log('='.repeat(60));
        
        for (const code of codes) {
            await processCode(code);
            
            if (stats.totalCodes % 50 === 0) {
                console.log(`\n📈 Progression: ${stats.totalCodes}/${codes.length}`);
                console.log(`   Trouvés: ${stats.productsFound}, Non trouvés: ${stats.productsNotFound}`);
                console.log(`   Images: ${stats.imagesUploaded}`);
            }
            
            await new Promise(r => setTimeout(r, 600));
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 RÉSUMÉ');
        console.log('='.repeat(60));
        console.log(`Codes traités:        ${stats.totalCodes}`);
        console.log(`Produits trouvés:     ${stats.productsFound}`);
        console.log(`Produits non trouvés: ${stats.productsNotFound}`);
        console.log(`Images uploadées:     ${stats.imagesUploaded}`);
        console.log(`Images ignorées:      ${stats.imagesSkipped}`);
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

main();

