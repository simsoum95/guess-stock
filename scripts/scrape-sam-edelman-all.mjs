#!/usr/bin/env node
/**
 * Scrape TOUTES les images SAM EDELMAN (format GUESS et format HBSE)
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
    total: 0,
    withImages: 0,
    imagesUploaded: 0,
    notFound: 0,
    errors: 0
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
        
        $('img[src*="/media/catalog/product"]').each((_, el) => {
            let src = $(el).attr('src');
            if (src && !src.includes('placeholder') && !src.includes('swatch')) {
                src = src.replace(/\/cache\/[^/]+\//, '/');
                if (src.startsWith('/')) src = `https://www.globalonline.co.il${src}`;
                images.add(src);
            }
        });
        
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
        const filename = `${modelRef.toUpperCase()}_${color.toUpperCase()}_${index}${ext}`;
        
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
        
        if (uploadError) throw new Error(uploadError.message);
        
        const { data: { publicUrl } } = supabase.storage
            .from('guess-images')
            .getPublicUrl(filename);
        
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

async function hasExistingImages(modelRef) {
    const { count } = await supabase
        .from('image_index')
        .select('*', { count: 'exact', head: true })
        .eq('model_ref', modelRef.toUpperCase());
    
    return (count || 0) >= 1;
}

async function main() {
    console.log('🚀 Scraping TOUTES les images SAM EDELMAN depuis GlobalOnline');
    console.log('='.repeat(60));
    
    // Récupérer les produits depuis Google Sheet
    const sheetName = 'נעליים SAM';
    const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    
    const response = await fetch(url);
    const text = await response.text();
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
    const data = JSON.parse(jsonMatch[1]);
    const rows = data.table?.rows || [];
    
    const uniqueProducts = new Map(); // modelRef -> color
    
    for (const row of rows) {
        const cells = row.c || [];
        const itemCode = cells[6]?.v?.toString() || '';
        const color = cells[7]?.v?.toString() || 'DEFAULT';
        
        if (!itemCode) continue;
        
        // Extraire modelRef
        let modelRef;
        const parts = itemCode.split('-');
        if (parts.length >= 3) {
            modelRef = `${parts[0]}-${parts[1]}-${parts[2]}`;
        } else {
            modelRef = parts[0];
        }
        
        if (!uniqueProducts.has(modelRef)) {
            uniqueProducts.set(modelRef, color.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10) || 'DEFAULT');
        }
    }
    
    console.log(`\n📊 ${uniqueProducts.size} produits uniques à traiter`);
    console.log('='.repeat(60));
    
    for (const [modelRef, color] of uniqueProducts) {
        stats.total++;
        
        // Vérifier si a déjà des images
        const hasImages = await hasExistingImages(modelRef);
        if (hasImages) {
            console.log(`⏭️  ${modelRef}: déjà des images`);
            continue;
        }
        
        const { found, images } = await scrapeProductImages(modelRef);
        
        if (!found || images.length === 0) {
            stats.notFound++;
            console.log(`❌ ${modelRef}: non trouvé sur GlobalOnline`);
            continue;
        }
        
        let uploadedCount = 0;
        for (let i = 0; i < Math.min(images.length, 5); i++) {
            const result = await downloadAndUploadImage(images[i], modelRef, color, i + 1);
            if (result.success) {
                uploadedCount++;
                stats.imagesUploaded++;
            }
            await new Promise(r => setTimeout(r, 200));
        }
        
        if (uploadedCount > 0) {
            stats.withImages++;
            console.log(`✅ ${modelRef}: ${uploadedCount} images`);
        }
        
        await new Promise(r => setTimeout(r, 300));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`📝 Produits traités:      ${stats.total}`);
    console.log(`✅ Avec nouvelles images: ${stats.withImages}`);
    console.log(`📸 Images uploadées:      ${stats.imagesUploaded}`);
    console.log(`🔍 Non trouvés:           ${stats.notFound}`);
    console.log(`❌ Erreurs:               ${stats.errors}`);
    console.log('='.repeat(60));
    console.log('\n✅ Terminé!');
}

main().catch(console.error);

