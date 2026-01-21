#!/usr/bin/env node
/**
 * Script pour scraper TOUTES les images de GlobalOnline via le sitemap
 * 
 * Le sitemap XML contient TOUS les liens produits du site
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables Supabase manquantes');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const stats = {
    sitemapsFound: 0,
    productUrls: 0,
    productsProcessed: 0,
    imagesUploaded: 0,
    errors: 0,
};

// Sitemaps possibles pour un site Magento
const SITEMAP_URLS = [
    'https://www.globalonline.co.il/sitemap.xml',
    'https://www.globalonline.co.il/pub/sitemap.xml',
    'https://www.globalonline.co.il/media/sitemap.xml',
    'https://www.globalonline.co.il/sitemap/sitemap.xml',
    'https://www.globalonline.co.il/sitemap_index.xml',
];

/**
 * Récupère un sitemap XML
 */
async function fetchSitemap(url) {
    try {
        console.log(`   Essai: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                'Accept': 'text/xml,application/xml,application/xhtml+xml,text/html',
            },
            timeout: 10000,
        });
        
        if (!response.ok) {
            return null;
        }
        
        const text = await response.text();
        if (!text.includes('<?xml') && !text.includes('<urlset') && !text.includes('<sitemapindex')) {
            return null;
        }
        
        return text;
    } catch (error) {
        return null;
    }
}

/**
 * Parse un sitemap et extrait les URLs produits
 */
function parseProductUrls(sitemapXml) {
    const $ = cheerio.load(sitemapXml, { xmlMode: true });
    const urls = [];
    
    // Extraire les URLs
    $('url loc, loc').each((_, el) => {
        const url = $(el).text().trim();
        // Filtrer pour garder seulement les pages produits
        if (url && 
            url.includes('globalonline.co.il/') && 
            url.endsWith('.html') &&
            !url.includes('/checkout') &&
            !url.includes('/cart') &&
            !url.includes('/customer') &&
            !url.includes('/catalogsearch') &&
            !url.includes('/wishlist') &&
            !url.includes('/contact') &&
            !url.includes('/privacy') &&
            !url.includes('/terms') &&
            !url.includes('/faq')) {
            urls.push(url);
        }
    });
    
    // Chercher aussi les sous-sitemaps
    const subSitemaps = [];
    $('sitemap loc').each((_, el) => {
        subSitemaps.push($(el).text().trim());
    });
    
    return { urls, subSitemaps };
}

/**
 * Scrape les images d'une page produit
 */
async function scrapeProductImages(productUrl) {
    try {
        const response = await fetch(productUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
            },
        });
        
        if (!response.ok) {
            return { found: false, images: [] };
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        // Vérifier que c'est une page produit
        if ($('.product-info-main, .product-essential').length === 0) {
            return { found: false, images: [] };
        }
        
        const images = new Set();
        
        // 1. Images src
        $('img[src*="/media/catalog/product"]').each((_, el) => {
            let src = $(el).attr('src');
            if (src && !src.includes('placeholder') && !src.includes('swatch')) {
                src = src.replace(/\/cache\/[^/]+\//, '/');
                if (src.startsWith('/')) src = `https://www.globalonline.co.il${src}`;
                images.add(src);
            }
        });
        
        // 2. Data-src
        $('img[data-src*="/media/catalog/product"]').each((_, el) => {
            let src = $(el).attr('data-src');
            if (src && !src.includes('placeholder')) {
                src = src.replace(/\/cache\/[^/]+\//, '/');
                if (src.startsWith('/')) src = `https://www.globalonline.co.il${src}`;
                images.add(src);
            }
        });
        
        // 3. Scripts JSON (galerie Magento)
        $('script').each((_, el) => {
            const content = $(el).html() || '';
            const matches = content.matchAll(/"(?:img|full|thumb|image)":\s*"([^"]+media\/catalog\/product[^"]+)"/g);
            for (const match of matches) {
                let url = match[1].replace(/\\\//g, '/');
                if (url.startsWith('/')) url = `https://www.globalonline.co.il${url}`;
                images.add(url);
            }
        });
        
        // Extraire SKU
        let sku = '';
        const skuEl = $('.product-info-stock-sku .value, [itemprop="sku"]').text().trim();
        if (skuEl) sku = skuEl.toUpperCase();
        
        // Ou depuis le titre
        if (!sku) {
            const title = $('h1.page-title span').text();
            const match = title.match(/([A-Z]{2}\d{6})/i);
            if (match) sku = match[1].toUpperCase();
        }
        
        // Ou depuis l'URL
        if (!sku) {
            const urlMatch = productUrl.match(/([a-z]{2}\d{6})/i);
            if (urlMatch) sku = urlMatch[1].toUpperCase();
        }
        
        // Filtrer
        const cleanImages = Array.from(images).filter(url => 
            url.includes('/media/catalog/product') && 
            !url.includes('placeholder') &&
            !url.includes('/swatch/') &&
            /\.(jpg|jpeg|png|webp)$/i.test(url)
        );
        
        // Dédupliquer
        const unique = new Map();
        for (const url of cleanImages) {
            const filename = url.split('/').pop();
            if (!unique.has(filename)) unique.set(filename, url);
        }
        
        return { found: true, images: Array.from(unique.values()), sku };
    } catch (error) {
        return { found: false, images: [], error: error.message };
    }
}

/**
 * Upload image
 */
async function downloadAndUpload(imageUrl, modelRef, index) {
    try {
        const response = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        
        if (!response.ok) return { success: false };
        
        const buffer = Buffer.from(await response.arrayBuffer());
        const originalName = imageUrl.split('/').pop();
        
        // Extraire couleur du nom
        let color = 'DEFAULT';
        const parts = originalName.replace(/\.[^.]+$/, '').split(/[_-]/);
        if (parts.length >= 2 && parts[1].length <= 10) {
            color = parts[1].toUpperCase();
        }
        
        const ext = path.extname(originalName) || '.jpg';
        const filename = `${modelRef}_${color}_${index}${ext}`.toUpperCase().replace(/[^A-Z0-9._-]/g, '_');
        
        // Check if exists
        const { data: exists } = await supabase
            .from('image_index')
            .select('id')
            .eq('filename', filename)
            .single();
        
        if (exists) return { success: false, reason: 'exists' };
        
        // Upload
        await supabase.storage
            .from('guess-images')
            .upload(`products/${filename}`, buffer, {
                contentType: `image/${ext.slice(1)}`,
                upsert: true
            });
        
        // Get URL
        const { data: { publicUrl } } = supabase.storage
            .from('guess-images')
            .getPublicUrl(`products/${filename}`);
        
        // Index
        await supabase.from('image_index').upsert({
            model_ref: modelRef,
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
 * Main
 */
async function main() {
    console.log('🚀 Scraping GlobalOnline via Sitemap');
    console.log('='.repeat(60));
    
    // 1. Trouver le sitemap
    console.log('\n📋 Recherche du sitemap...');
    let allProductUrls = new Set();
    
    for (const sitemapUrl of SITEMAP_URLS) {
        const xml = await fetchSitemap(sitemapUrl);
        if (xml) {
            console.log(`   ✅ Sitemap trouvé: ${sitemapUrl}`);
            stats.sitemapsFound++;
            
            const { urls, subSitemaps } = parseProductUrls(xml);
            urls.forEach(u => allProductUrls.add(u));
            
            // Traiter les sous-sitemaps
            for (const subUrl of subSitemaps) {
                console.log(`   📄 Sous-sitemap: ${subUrl}`);
                const subXml = await fetchSitemap(subUrl);
                if (subXml) {
                    const subResult = parseProductUrls(subXml);
                    subResult.urls.forEach(u => allProductUrls.add(u));
                }
            }
        }
    }
    
    if (allProductUrls.size === 0) {
        console.log('\n❌ Aucun sitemap trouvé. Essayons une autre méthode...');
        
        // Méthode alternative: robots.txt
        console.log('\n📋 Vérification de robots.txt...');
        try {
            const robotsResponse = await fetch('https://www.globalonline.co.il/robots.txt');
            if (robotsResponse.ok) {
                const robotsTxt = await robotsResponse.text();
                console.log('   robots.txt:');
                console.log(robotsTxt.substring(0, 500));
                
                // Chercher les sitemaps dans robots.txt
                const sitemapMatches = robotsTxt.matchAll(/Sitemap:\s*(.+)/gi);
                for (const match of sitemapMatches) {
                    const sitemapUrl = match[1].trim();
                    console.log(`   📄 Sitemap trouvé dans robots.txt: ${sitemapUrl}`);
                    const xml = await fetchSitemap(sitemapUrl);
                    if (xml) {
                        const { urls, subSitemaps } = parseProductUrls(xml);
                        urls.forEach(u => allProductUrls.add(u));
                        
                        for (const subUrl of subSitemaps) {
                            const subXml = await fetchSitemap(subUrl);
                            if (subXml) {
                                const subResult = parseProductUrls(subXml);
                                subResult.urls.forEach(u => allProductUrls.add(u));
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.log('   ❌ Impossible de lire robots.txt');
        }
    }
    
    stats.productUrls = allProductUrls.size;
    console.log(`\n📊 ${stats.productUrls} URLs de produits trouvées`);
    
    if (stats.productUrls === 0) {
        console.log('\n❌ Impossible de trouver les URLs des produits via sitemap.');
        console.log('Le site bloque probablement l\'accès au sitemap.');
        return;
    }
    
    console.log('='.repeat(60));
    
    // 2. Scraper chaque produit
    const productArray = Array.from(allProductUrls);
    
    for (let i = 0; i < productArray.length; i++) {
        const url = productArray[i];
        stats.productsProcessed++;
        
        // Extraire un identifiant de l'URL
        const urlPath = new URL(url).pathname;
        const productSlug = urlPath.replace('.html', '').split('/').pop();
        
        console.log(`\n[${i+1}/${productArray.length}] ${productSlug}`);
        
        const result = await scrapeProductImages(url);
        
        if (!result.found || result.images.length === 0) {
            console.log('   ⚠️ Pas d\'images');
            continue;
        }
        
        const sku = result.sku || productSlug.toUpperCase().replace(/-/g, '_');
        console.log(`   📸 ${result.images.length} images, SKU: ${sku}`);
        
        // Upload
        for (let j = 0; j < result.images.length && j < 10; j++) {
            const uploadResult = await downloadAndUpload(result.images[j], sku, j + 1);
            if (uploadResult.success) {
                stats.imagesUploaded++;
                console.log(`   ✅ ${uploadResult.filename}`);
            }
            await new Promise(r => setTimeout(r, 200));
        }
        
        // Progress
        if (i > 0 && i % 50 === 0) {
            console.log(`\n📈 Progression: ${i}/${productArray.length} - Images: ${stats.imagesUploaded}`);
        }
        
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`Sitemaps trouvés:     ${stats.sitemapsFound}`);
    console.log(`URLs produits:        ${stats.productUrls}`);
    console.log(`Produits traités:     ${stats.productsProcessed}`);
    console.log(`Images uploadées:     ${stats.imagesUploaded}`);
    console.log(`Erreurs:              ${stats.errors}`);
    console.log('='.repeat(60));
}

main().catch(console.error);

