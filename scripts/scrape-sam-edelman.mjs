#!/usr/bin/env node
/**
 * Script pour scraper les images SAM EDELMAN depuis GlobalOnline
 * en utilisant les codes produits connus
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

// Liste des codes SAM EDELMAN connus (depuis GlobalOnline)
const SAM_EDELMAN_CODES = [
    'hbse-325-0007', 'hbse-325-0012', 'hbse-325-0013', 'hbse-325-0017',
    'hbse-325-0029', 'hbse-325-0037', 'hbse-125-0011', 'hbse-125-0018',
    'hbse-225-0107', 'hbse-225-0115', 'sbse-825-0116', 'sbse-825-0121',
    'fese-725-0089', 'fese-725-0093', 'fese-725-0102', 'fese-725-0108'
];

const stats = {
    totalProducts: 0,
    productsWithImages: 0,
    imagesUploaded: 0,
    errors: 0,
    notFound: 0
};

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
        
        // Chercher les images de la galerie
        $('img[src*="/media/catalog/product"]').each((_, el) => {
            let src = $(el).attr('src');
            if (src && !src.includes('placeholder') && !src.includes('swatch')) {
                src = src.replace(/\/cache\/[^/]+\//, '/');
                if (src.startsWith('/')) src = `https://www.globalonline.co.il${src}`;
                images.add(src);
            }
        });
        
        // Chercher dans les scripts
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

async function downloadAndUploadImage(imageUrl, modelRef, color, index) {
    try {
        const response = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const buffer = Buffer.from(await response.arrayBuffer());
        const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
        const filename = `${modelRef}_${color}_${index}${ext}`.toUpperCase();
        
        // Uploader sur Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('guess-images')
            .upload(filename, buffer, {
                contentType: `image/${ext.slice(1)}`,
                upsert: true
            });
        
        if (uploadError) throw new Error(uploadError.message);
        
        const { data: { publicUrl } } = supabase.storage
            .from('guess-images')
            .getPublicUrl(filename);
        
        // Indexer
        await supabase.from('image_index').upsert({
            model_ref: modelRef.toUpperCase(),
            color: color.toUpperCase(),
            filename: filename,
            url: publicUrl,
            created_at: new Date().toISOString()
        }, { onConflict: 'filename' });
        
        return { success: true, filename };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

async function processProduct(productCode) {
    stats.totalProducts++;
    const modelRef = productCode.toUpperCase();
    
    console.log(`\n🔍 Scraping ${modelRef}...`);
    
    const { found, images, error } = await scrapeProductImages(productCode);
    
    if (!found) {
        console.log(`   ⚠️ Non trouvé sur GlobalOnline`);
        stats.notFound++;
        return;
    }
    
    if (images.length === 0) {
        console.log(`   ⚠️ Aucune image trouvée`);
        return;
    }
    
    console.log(`   📸 ${images.length} images trouvées`);
    
    let uploadedCount = 0;
    for (let i = 0; i < Math.min(images.length, 5); i++) {
        // Extraire couleur du nom de fichier si possible
        const urlPath = new URL(images[i]).pathname;
        const filename = urlPath.split('/').pop();
        const parts = filename.replace(/\.[^.]+$/, '').split(/[_-]/);
        const color = parts.length >= 2 ? parts[1].toUpperCase() : 'DEFAULT';
        
        const result = await downloadAndUploadImage(images[i], modelRef, color, i + 1);
        
        if (result.success) {
            uploadedCount++;
            stats.imagesUploaded++;
            console.log(`   ✅ ${result.filename}`);
        } else {
            console.log(`   ❌ ${result.reason}`);
        }
        
        await new Promise(r => setTimeout(r, 300));
    }
    
    if (uploadedCount > 0) {
        stats.productsWithImages++;
        console.log(`   ✅ ${uploadedCount} images ajoutées`);
    }
}

async function main() {
    console.log('🚀 Scraping SAM EDELMAN depuis GlobalOnline');
    console.log('='.repeat(60));
    console.log(`📊 ${SAM_EDELMAN_CODES.length} produits à traiter`);
    console.log('='.repeat(60));
    
    for (const code of SAM_EDELMAN_CODES) {
        await processProduct(code);
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`📝 Produits traités:      ${stats.totalProducts}`);
    console.log(`✅ Produits avec images:  ${stats.productsWithImages}`);
    console.log(`📸 Images uploadées:      ${stats.imagesUploaded}`);
    console.log(`🔍 Non trouvés:           ${stats.notFound}`);
    console.log(`❌ Erreurs:               ${stats.errors}`);
    console.log('='.repeat(60));
    console.log('\n✅ Terminé!');
}

main().catch(console.error);

