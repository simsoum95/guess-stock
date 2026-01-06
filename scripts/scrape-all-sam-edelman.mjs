#!/usr/bin/env node
/**
 * Script pour scraper TOUTES les images SAM EDELMAN depuis GlobalOnline
 * en utilisant les codes produits du Google Sheet
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
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables Supabase manquantes');
    process.exit(1);
}

if (!GOOGLE_SHEET_ID) {
    console.error('❌ GOOGLE_SHEET_ID manquant');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const stats = {
    totalProducts: 0,
    productsWithImages: 0,
    imagesUploaded: 0,
    alreadyHaveImages: 0,
    errors: 0,
    notFound: 0
};

/**
 * Récupère les codes produits SAM EDELMAN depuis Google Sheets
 */
async function getSamEdelmanCodesFromSheet() {
    console.log('📋 Récupération des codes SAM EDELMAN depuis Google Sheets...');
    
    const sheetName = 'נעליים SAM'; // ou 'SAM EDELMAN'
    const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        
        const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
        if (!jsonMatch) {
            throw new Error('Format de réponse invalide');
        }
        
        const data = JSON.parse(jsonMatch[1]);
        const rows = data.table?.rows || [];
        const cols = data.table?.cols || [];
        
        // Trouver la colonne "קוד פריט" (itemCode)
        let itemCodeColIndex = -1;
        for (let i = 0; i < cols.length; i++) {
            const label = cols[i].label?.toLowerCase() || '';
            if (label.includes('קוד פריט') || label === 'itemcode') {
                itemCodeColIndex = i;
                break;
            }
        }
        
        if (itemCodeColIndex === -1) {
            itemCodeColIndex = 6; // Colonne G
        }
        
        console.log(`   📊 Colonne itemCode trouvée à l'index ${itemCodeColIndex}`);
        
        const productCodes = new Set();
        
        for (const row of rows) {
            const cells = row.c || [];
            const itemCode = cells[itemCodeColIndex]?.v?.toString().trim();
            
            if (itemCode) {
                // Pour SAM EDELMAN: "HBSE-125-0011-BLACK-OS" -> "HBSE-125-0011" (3 premières parties)
                const parts = itemCode.split('-');
                if (parts.length >= 3) {
                    const productCode = `${parts[0]}-${parts[1]}-${parts[2]}`.toLowerCase();
                    productCodes.add(productCode);
                }
            }
        }
        
        console.log(`   ✅ ${productCodes.size} codes produits uniques trouvés`);
        return Array.from(productCodes);
    } catch (error) {
        console.error('❌ Erreur lecture Google Sheets:', error.message);
        return [];
    }
}

/**
 * Vérifie si un produit a déjà des images
 */
async function hasExistingImages(modelRef) {
    const { count } = await supabase
        .from('image_index')
        .select('*', { count: 'exact', head: true })
        .eq('model_ref', modelRef.toUpperCase());
    
    return (count || 0) >= 2;
}

/**
 * Scrape les images d'un produit
 */
async function scrapeProductImages(productCode) {
    const url = `https://www.globalonline.co.il/${productCode.toLowerCase()}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            },
        });
        
        if (!response.ok) {
            return { found: false, images: [] };
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const images = new Set();
        
        // Images de la galerie
        $('img[src*="/media/catalog/product"]').each((_, el) => {
            let src = $(el).attr('src');
            if (src && !src.includes('placeholder') && !src.includes('swatch')) {
                src = src.replace(/\/cache\/[^/]+\//, '/');
                if (src.startsWith('/')) src = `https://www.globalonline.co.il${src}`;
                images.add(src);
            }
        });
        
        // Images dans les scripts JSON
        $('script').each((_, el) => {
            const content = $(el).html() || '';
            const imgMatches = content.matchAll(/"(?:img|full|thumb|image)":\s*"([^"]+media\/catalog\/product[^"]+)"/g);
            for (const match of imgMatches) {
                let imgUrl = match[1].replace(/\\\//g, '/');
                if (imgUrl.startsWith('/')) imgUrl = `https://www.globalonline.co.il${imgUrl}`;
                images.add(imgUrl);
            }
        });
        
        const cleanImages = Array.from(images).filter(url => 
            url.includes('/media/catalog/product') && 
            !url.includes('placeholder') &&
            !url.includes('/swatch/') &&
            (url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png') || url.endsWith('.webp'))
        );
        
        return { found: true, images: cleanImages };
    } catch (error) {
        return { found: false, images: [], error: error.message };
    }
}

/**
 * Télécharge et uploade une image
 */
async function downloadAndUploadImage(imageUrl, modelRef, index) {
    try {
        const response = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Extraire couleur du nom de fichier
        const urlPath = new URL(imageUrl).pathname;
        const filename = urlPath.split('/').pop();
        const parts = filename.replace(/\.[^.]+$/, '').split(/[_-]/);
        let color = parts.length >= 2 ? parts[1].toUpperCase() : 'DEFAULT';
        
        const ext = path.extname(filename) || '.jpg';
        const newFilename = `${modelRef.toUpperCase()}_${color}_${index}${ext}`.toUpperCase();
        
        // Vérifier si existe déjà
        const { data: existing } = await supabase
            .from('image_index')
            .select('id')
            .eq('filename', newFilename)
            .single();
        
        if (existing) {
            return { success: false, reason: 'exists' };
        }
        
        // Uploader
        const { error: uploadError } = await supabase.storage
            .from('guess-images')
            .upload(newFilename, buffer, {
                contentType: `image/${ext.slice(1)}`,
                upsert: true
            });
        
        if (uploadError) throw new Error(uploadError.message);
        
        const { data: { publicUrl } } = supabase.storage
            .from('guess-images')
            .getPublicUrl(newFilename);
        
        // Indexer
        await supabase.from('image_index').upsert({
            model_ref: modelRef.toUpperCase(),
            color: color,
            filename: newFilename,
            url: publicUrl,
            created_at: new Date().toISOString()
        }, { onConflict: 'filename' });
        
        return { success: true, filename: newFilename };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

/**
 * Traite un produit
 */
async function processProduct(productCode, skipIfHasImages = true) {
    stats.totalProducts++;
    const modelRef = productCode.toUpperCase();
    
    // Vérifier si a déjà des images
    if (skipIfHasImages) {
        const hasImages = await hasExistingImages(modelRef);
        if (hasImages) {
            stats.alreadyHaveImages++;
            return;
        }
    }
    
    const { found, images } = await scrapeProductImages(productCode);
    
    if (!found) {
        stats.notFound++;
        return;
    }
    
    if (images.length === 0) {
        return;
    }
    
    let uploadedCount = 0;
    for (let i = 0; i < Math.min(images.length, 5); i++) {
        const result = await downloadAndUploadImage(images[i], modelRef, i + 1);
        
        if (result.success) {
            uploadedCount++;
            stats.imagesUploaded++;
        }
        
        await new Promise(r => setTimeout(r, 200));
    }
    
    if (uploadedCount > 0) {
        stats.productsWithImages++;
        console.log(`✅ ${modelRef}: ${uploadedCount} images`);
    }
}

async function main() {
    console.log('🚀 Scraping SAM EDELMAN depuis GlobalOnline');
    console.log('='.repeat(60));
    
    // Récupérer les codes depuis Google Sheets
    const productCodes = await getSamEdelmanCodesFromSheet();
    
    if (productCodes.length === 0) {
        console.log('❌ Aucun code produit trouvé');
        return;
    }
    
    console.log(`\n📊 ${productCodes.length} produits à traiter`);
    console.log('='.repeat(60));
    
    // Traiter chaque produit
    for (let i = 0; i < productCodes.length; i++) {
        await processProduct(productCodes[i]);
        
        // Progression
        if ((i + 1) % 20 === 0) {
            console.log(`\n📈 Progression: ${i + 1}/${productCodes.length} (${Math.round((i + 1) / productCodes.length * 100)}%)`);
            console.log(`   ✅ Images uploadées: ${stats.imagesUploaded}`);
            console.log(`   ⏭️  Déjà avec images: ${stats.alreadyHaveImages}`);
            console.log(`   🔍 Non trouvés: ${stats.notFound}\n`);
        }
        
        await new Promise(r => setTimeout(r, 300));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ FINAL');
    console.log('='.repeat(60));
    console.log(`📝 Produits traités:      ${stats.totalProducts}`);
    console.log(`✅ Nouvelles images:      ${stats.productsWithImages}`);
    console.log(`📸 Images uploadées:      ${stats.imagesUploaded}`);
    console.log(`⏭️  Déjà avec images:     ${stats.alreadyHaveImages}`);
    console.log(`🔍 Non trouvés:           ${stats.notFound}`);
    console.log(`❌ Erreurs:               ${stats.errors}`);
    console.log('='.repeat(60));
    console.log('\n✅ Terminé!');
}

main().catch(console.error);

