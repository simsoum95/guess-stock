#!/usr/bin/env node
/**
 * Scrape VILEBREQUIN avec TOUTES les couleurs depuis GlobalOnline
 * Les URLs des variantes couleur ont souvent un suffix comme -010, -390, etc.
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

if (!supabaseUrl || !supabaseKey || !GOOGLE_SHEET_ID) {
    console.error('❌ Variables manquantes');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const stats = {
    productsProcessed: 0,
    colorsFound: 0,
    imagesUploaded: 0,
    errors: 0
};

// Mapping des noms de couleurs vers codes couleur GlobalOnline
const COLOR_CODES = {
    'BLANC': ['010', '101', 'WHITE', 'BLANC'],
    'BLEU': ['390', '340', '320', 'BLUE', 'BLEU', 'MARINE', 'NAVY'],
    'BLEU MARINE': ['390', 'NAVY', 'MARINE'],
    'NOIR': ['999', '900', 'BLACK', 'NOIR'],
    'ROUGE': ['300', '350', 'RED', 'ROUGE'],
    'VERT': ['500', '550', 'GREEN', 'VERT'],
    'JAUNE': ['200', 'YELLOW', 'JAUNE'],
    'ORANGE': ['250', 'ORANGE'],
    'ROSE': ['370', 'PINK', 'ROSE'],
    'GRIS': ['800', 'GREY', 'GRAY', 'GRIS'],
    'BEIGE': ['100', 'BEIGE', 'SAND'],
    'MARRON': ['600', 'BROWN', 'MARRON'],
};

/**
 * Récupère toutes les images d'une page produit
 */
async function scrapeProductPage(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });
        
        if (!response.ok) return [];
        
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
        
        // Images dans scripts JSON
        $('script').each((_, el) => {
            const content = $(el).html() || '';
            const imgMatches = content.matchAll(/"(?:img|full|thumb|image)":\s*"([^"]+media\/catalog\/product[^"]+)"/g);
            for (const match of imgMatches) {
                let imgUrl = match[1].replace(/\\\//g, '/');
                if (imgUrl.startsWith('/')) imgUrl = `https://www.globalonline.co.il${imgUrl}`;
                images.add(imgUrl);
            }
        });
        
        return Array.from(images).filter(url => 
            url.includes('/media/catalog/product') && 
            !url.includes('placeholder') &&
            !url.includes('/swatch/')
        );
    } catch (error) {
        return [];
    }
}

/**
 * Essaie de trouver les variantes de couleur pour un produit
 */
async function findColorVariants(modelRef) {
    const variants = [];
    
    // URL de base
    const baseUrl = `https://www.globalonline.co.il/${modelRef.toLowerCase()}`;
    
    // Essayer l'URL de base
    const baseImages = await scrapeProductPage(baseUrl);
    if (baseImages.length > 0) {
        // Extraire le code couleur du nom de fichier
        // Ex: plth2n00_010_1.jpg -> 010
        const colorCodes = new Set();
        for (const img of baseImages) {
            const filename = img.split('/').pop() || '';
            const match = filename.match(/_(\d{3})_/);
            if (match) {
                colorCodes.add(match[1]);
            }
        }
        
        if (colorCodes.size > 0) {
            for (const code of colorCodes) {
                const codeImages = baseImages.filter(img => img.includes(`_${code}_`));
                if (codeImages.length > 0) {
                    variants.push({ colorCode: code, images: codeImages });
                }
            }
        } else {
            // Pas de code couleur détecté, utiliser DEFAULT
            variants.push({ colorCode: 'DEFAULT', images: baseImages });
        }
    }
    
    // Essayer des suffixes de couleur courants
    const colorSuffixes = ['010', '390', '999', '300', '500', '200', '800', '100'];
    for (const suffix of colorSuffixes) {
        const colorUrl = `${baseUrl}-${suffix}`;
        const images = await scrapeProductPage(colorUrl);
        if (images.length > 0) {
            const existing = variants.find(v => v.colorCode === suffix);
            if (!existing) {
                variants.push({ colorCode: suffix, images });
            }
        }
        await new Promise(r => setTimeout(r, 200));
    }
    
    return variants;
}

async function downloadAndUploadImage(imageUrl, modelRef, colorCode, index) {
    try {
        const response = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const buffer = Buffer.from(await response.arrayBuffer());
        
        const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
        const filename = `${modelRef.toUpperCase()}_${colorCode}_${index}${ext}`;
        
        // Vérifier si existe déjà
        const { data: existing } = await supabase
            .from('image_index')
            .select('id')
            .eq('filename', filename)
            .single();
        
        if (existing) {
            return { success: false, reason: 'exists' };
        }
        
        const { error: uploadError } = await supabase.storage
            .from('guess-images')
            .upload(filename, buffer, {
                contentType: `image/${ext.slice(1)}`,
                upsert: true
            });
        
        if (uploadError && !uploadError.message.includes('already exists')) {
            throw new Error(uploadError.message);
        }
        
        const { data: { publicUrl } } = supabase.storage
            .from('guess-images')
            .getPublicUrl(filename);
        
        await supabase.from('image_index').upsert({
            model_ref: modelRef.toUpperCase(),
            color: colorCode,
            filename: filename,
            url: publicUrl,
            created_at: new Date().toISOString()
        }, { onConflict: 'filename' });
        
        return { success: true, filename };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

async function main() {
    console.log('🚀 Scraping VILEBREQUIN avec couleurs');
    console.log('='.repeat(60));
    
    // Récupérer les produits VILEBREQUIN depuis Google Sheet
    const sheetName = 'VILEBREQUIN';
    const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    
    const response = await fetch(url);
    const text = await response.text();
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
    const data = JSON.parse(jsonMatch[1]);
    const rows = data.table?.rows || [];
    
    // Extraire les produits uniques avec leur couleur
    const products = new Map(); // modelRef -> Set de couleurs
    
    for (const row of rows) {
        const cells = row.c || [];
        const itemCode = cells[6]?.v?.toString() || '';
        const color = cells[7]?.v?.toString() || 'DEFAULT';
        
        if (!itemCode) continue;
        
        let modelRef;
        const parts = itemCode.split('-');
        if (parts.length >= 3) {
            modelRef = `${parts[0]}-${parts[1]}-${parts[2]}`;
        } else {
            modelRef = parts[0];
        }
        
        if (!products.has(modelRef)) {
            products.set(modelRef, new Set());
        }
        products.get(modelRef).add(color.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    }
    
    console.log(`\n📊 ${products.size} produits VILEBREQUIN à traiter`);
    console.log('='.repeat(60));
    
    for (const [modelRef, colors] of products) {
        console.log(`\n🔍 ${modelRef} (couleurs demandées: ${Array.from(colors).join(', ')})`);
        stats.productsProcessed++;
        
        // Trouver les variantes de couleur
        const variants = await findColorVariants(modelRef);
        
        if (variants.length === 0) {
            console.log(`   ❌ Aucune image trouvée`);
            stats.errors++;
            continue;
        }
        
        console.log(`   📸 ${variants.length} variantes trouvées: ${variants.map(v => v.colorCode).join(', ')}`);
        
        for (const variant of variants) {
            stats.colorsFound++;
            
            for (let i = 0; i < Math.min(variant.images.length, 3); i++) {
                const result = await downloadAndUploadImage(variant.images[i], modelRef, variant.colorCode, i + 1);
                if (result.success) {
                    stats.imagesUploaded++;
                    console.log(`      ✅ ${result.filename}`);
                }
            }
        }
        
        await new Promise(r => setTimeout(r, 300));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`📝 Produits traités:   ${stats.productsProcessed}`);
    console.log(`🎨 Variantes trouvées: ${stats.colorsFound}`);
    console.log(`📸 Images uploadées:   ${stats.imagesUploaded}`);
    console.log(`❌ Erreurs:            ${stats.errors}`);
    console.log('='.repeat(60));
}

main().catch(console.error);

