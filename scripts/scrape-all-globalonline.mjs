#!/usr/bin/env node
/**
 * Script pour scraper TOUTES les images de GlobalOnline pour TOUS les produits
 * Basé sur le script qui fonctionnait déjà
 * 
 * Usage:
 *   node scripts/scrape-all-globalonline.mjs              # Normal
 *   node scripts/scrape-all-globalonline.mjs --force      # Re-télécharger tout
 *   node scripts/scrape-all-globalonline.mjs --categories # Scraper les catégories
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';

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

// TOUTES les catégories à scraper
const CATEGORIES = [
    // GUESS - Bags
    'https://www.globalonline.co.il/brands/guess/bags.html',
    
    // GUESS - Shoes
    'https://www.globalonline.co.il/brands/guess/shoes.html',
    
    // Women - Bags
    'https://www.globalonline.co.il/women/bags.html',
    'https://www.globalonline.co.il/women/bags/tik-tzad.html',
    'https://www.globalonline.co.il/women/bags/tik-gav.html',
    'https://www.globalonline.co.il/women/bags/arnakot.html',
    'https://www.globalonline.co.il/women/bags/pouches.html',
    'https://www.globalonline.co.il/women/bags/tik-erev.html',
    'https://www.globalonline.co.il/women/bags/tik-nesia.html',
    'https://www.globalonline.co.il/women/bags/mizvadot.html',
    'https://www.globalonline.co.il/women/bags/tik-mini.html',
    
    // Women - Shoes
    'https://www.globalonline.co.il/women/shoes.html',
    'https://www.globalonline.co.il/women/shoes/megafayim.html',
    'https://www.globalonline.co.il/women/shoes/sneakers.html',
    'https://www.globalonline.co.il/women/shoes/naalei-akev.html',
    'https://www.globalonline.co.il/women/shoes/sandalim.html',
    'https://www.globalonline.co.il/women/shoes/kafkafim.html',
    
    // Men - Shoes
    'https://www.globalonline.co.il/men/shoes.html',
    'https://www.globalonline.co.il/men/shoes/sneakers.html',
    'https://www.globalonline.co.il/men/shoes/kafkafim.html',
    
    // Men - Bags
    'https://www.globalonline.co.il/men/bags.html',
    
    // SAM EDELMAN
    'https://www.globalonline.co.il/brands/sam-edelman.html',
    'https://www.globalonline.co.il/brands/sam-edelman/bags.html',
    'https://www.globalonline.co.il/brands/sam-edelman/sneakers.html',
    'https://www.globalonline.co.il/brands/sam-edelman/naalei-akev.html',
    'https://www.globalonline.co.il/brands/sam-edelman/sandalim.html',
    'https://www.globalonline.co.il/brands/sam-edelman/kafkafim.html',
    'https://www.globalonline.co.il/brands/sam-edelman/megafayim.html',
    
    // VILEBREQUIN
    'https://www.globalonline.co.il/brands/vilebrequin.html',
    'https://www.globalonline.co.il/brands/vilebrequin/men.html',
    'https://www.globalonline.co.il/brands/vilebrequin/women.html',
    'https://www.globalonline.co.il/brands/vilebrequin/kids.html',
    'https://www.globalonline.co.il/brands/vilebrequin/accessories.html',
    
    // DKNY
    'https://www.globalonline.co.il/brands/dkny.html',
    
    // BAYTON
    'https://www.globalonline.co.il/brands/bayton.html',
    
    // CIRCUS NY
    'https://www.globalonline.co.il/brands/circus-ny.html',
];

// Stats globales
const stats = {
    categoriesScraped: 0,
    totalProducts: 0,
    productsWithNewImages: 0,
    imagesDownloaded: 0,
    imagesUploaded: 0,
    errors: 0,
    skipped: 0,
    notFound: 0
};

/**
 * Scrape une page de catégorie pour trouver tous les liens produits
 */
async function scrapeProductLinksFromCategory(categoryUrl) {
    console.log(`\n📋 Scraping catégorie: ${categoryUrl}`);
    
    const productLinks = new Set();
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 30) { // Max 30 pages par catégorie
        const url = page === 1 ? categoryUrl : `${categoryUrl}?p=${page}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Cache-Control': 'no-cache',
                },
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    hasMore = false;
                    continue;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const html = await response.text();
            const $ = cheerio.load(html);
            
            // Chercher tous les liens vers des produits
            $('a[href*=".html"]').each((_, el) => {
                const href = $(el).attr('href');
                if (href && 
                    href.includes('globalonline.co.il/') && 
                    !href.includes('/checkout') &&
                    !href.includes('/cart') &&
                    !href.includes('/customer') &&
                    !href.includes('/catalogsearch') &&
                    !href.includes('?') &&
                    href.match(/\/[a-z0-9-]+-[a-z0-9-]+\.html$/i)) {
                    productLinks.add(href);
                }
            });
            
            // Vérifier s'il y a une page suivante
            const nextPageLink = $('a.action.next, .pages-item-next a, a[title="Next"]').attr('href');
            hasMore = !!nextPageLink;
            
            if (productLinks.size > 0) {
                console.log(`   Page ${page}: ${productLinks.size} produits trouvés`);
            }
            
            page++;
            await new Promise(resolve => setTimeout(resolve, 800)); // Pause entre les pages
            
        } catch (error) {
            console.error(`   ❌ Erreur page ${page}:`, error.message);
            hasMore = false;
        }
    }
    
    stats.categoriesScraped++;
    return Array.from(productLinks);
}

/**
 * Extrait le SKU et la couleur d'une URL de produit
 */
function extractProductInfo(productUrl) {
    // URL format: https://www.globalonline.co.il/guess-noelle-mini-flap-shoulder-bag-bg840278-black.html
    // Ou: https://www.globalonline.co.il/jimc3b27-390.html
    
    const urlPath = new URL(productUrl).pathname;
    const filename = urlPath.replace('.html', '').split('/').pop();
    
    // Chercher un pattern SKU (ex: BG840278, OS811819, JIMC3B27, HBSE-325-0007)
    let sku = '';
    let color = '';
    
    // Pattern 1: SKU-COLOR (ex: bg840278-black)
    const match1 = filename.match(/([a-z]{2}\d{6})-([a-z]+)$/i);
    if (match1) {
        sku = match1[1].toUpperCase();
        color = match1[2].toUpperCase();
        return { sku, color, filename };
    }
    
    // Pattern 2: SKU VILEBREQUIN (ex: jimc3b27-390)
    const match2 = filename.match(/([a-z]{4}\d{1,2}[a-z]\d{2})-(\d{3})$/i);
    if (match2) {
        sku = match2[1].toUpperCase();
        color = match2[2];
        return { sku, color, filename };
    }
    
    // Pattern 3: SAM EDELMAN (ex: hbse-325-0007)
    const match3 = filename.match(/(hbse|fese|sbse)-(\d{3})-(\d{4})/i);
    if (match3) {
        sku = `${match3[1]}-${match3[2]}-${match3[3]}`.toUpperCase();
        return { sku, color: '', filename };
    }
    
    // Pattern 4: Chercher n'importe quel code dans le nom
    const anyCode = filename.match(/([a-z]{2}\d{6}|[a-z]{4}\d{1,2}[a-z]\d{2})/i);
    if (anyCode) {
        sku = anyCode[1].toUpperCase();
        
        // Essayer d'extraire la couleur après le SKU
        const afterSku = filename.substring(filename.toLowerCase().indexOf(anyCode[1].toLowerCase()) + anyCode[1].length);
        const colorMatch = afterSku.match(/^-([a-z]+)/i);
        if (colorMatch) {
            color = colorMatch[1].toUpperCase();
        }
        return { sku, color, filename };
    }
    
    return { sku: '', color: '', filename };
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
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                return { found: false, images: [] };
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const images = new Set();
        
        // 1. Images dans la galerie principale
        $('img[src*="/media/catalog/product"]').each((_, el) => {
            let src = $(el).attr('src');
            if (src && !src.includes('placeholder') && !src.includes('swatch')) {
                // Enlever le cache pour avoir l'image haute qualité
                if (src.includes('/cache/')) {
                    src = src.replace(/\/cache\/[^/]+\//, '/');
                }
                if (src.startsWith('/')) src = `https://www.globalonline.co.il${src}`;
                images.add(src);
            }
        });
        
        // 2. Images dans data-src (lazy loading)
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
        
        // 3. Chercher dans les scripts JSON la configuration de galerie
        $('script').each((_, el) => {
            const content = $(el).html() || '';
            
            // Pattern 1: "img": "/media/catalog/product..."
            const imgMatches = content.matchAll(/"(?:img|full|thumb|image)":\s*"([^"]+media\/catalog\/product[^"]+)"/g);
            for (const match of imgMatches) {
                let imgUrl = match[1].replace(/\\\//g, '/');
                if (imgUrl.startsWith('/')) imgUrl = `https://www.globalonline.co.il${imgUrl}`;
                images.add(imgUrl);
            }
            
            // Pattern 2: URLs directes dans le script
            const urlMatches = content.matchAll(/https?:\/\/[^"'\s]+\/media\/catalog\/product\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi);
            for (const match of urlMatches) {
                images.add(match[0]);
            }
        });
        
        // 4. Images dans data-mage-init
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
        
        // 5. Data attributes
        $('[data-full], [data-zoom-image]').each((_, el) => {
            const src = $(el).attr('data-full') || $(el).attr('data-zoom-image');
            if (src && src.includes('/media/catalog/product')) {
                let imgUrl = src;
                if (imgUrl.startsWith('/')) imgUrl = `https://www.globalonline.co.il${imgUrl}`;
                images.add(imgUrl);
            }
        });
        
        // Extraire le titre et le SKU de la page
        let pageSku = '';
        let pageTitle = $('h1.page-title span, h1.product-name').text().trim();
        
        // Chercher le SKU dans le titre
        const skuInTitle = pageTitle.match(/([A-Z]{2}\d{6})/i);
        if (skuInTitle) {
            pageSku = skuInTitle[1].toUpperCase();
        }
        
        // Ou dans la structure SKU dédiée
        const skuEl = $('.product-info-stock-sku .value, [itemprop="sku"]').text().trim();
        if (skuEl) {
            pageSku = skuEl.toUpperCase();
        }
        
        // Filtrer et nettoyer les URLs
        const cleanImages = Array.from(images)
            .filter(url => {
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
        
        return { found: true, images: Array.from(uniqueByFilename.values()), pageSku, pageTitle };
    } catch (error) {
        return { found: false, images: [], error: error.message };
    }
}

/**
 * Télécharge une image et l'uploade sur Supabase
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
        
        // Extraire le nom de fichier original
        const urlPath = new URL(imageUrl).pathname;
        const originalFilename = urlPath.split('/').pop();
        
        // Déterminer la couleur depuis le nom de fichier si pas fournie
        if (!color) {
            const filenameParts = originalFilename.replace(/\.[^.]+$/, '').split(/[_-]/);
            if (filenameParts.length >= 2) {
                const potentialColor = filenameParts[1];
                if (potentialColor && potentialColor.length <= 10) {
                    color = potentialColor.toUpperCase();
                }
            }
        }
        if (!color) color = 'DEFAULT';
        
        // Créer un nom de fichier unique
        const ext = path.extname(originalFilename) || '.jpg';
        const filename = `${modelRef}_${color}_${index}${ext}`.toUpperCase().replace(/[^A-Z0-9._-]/g, '_');
        const storagePath = `products/${filename}`;
        
        // Vérifier si l'image existe déjà dans l'index
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
        
        if (uploadError && !uploadError.message.includes('already exists')) {
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
                color: color,
                filename: filename,
                url: publicUrl,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'filename'
            });
        
        if (indexError) {
            console.warn(`   ⚠️ Indexation échouée:`, indexError.message);
        }
        
        return { success: true, filename, url: publicUrl };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

/**
 * Traite un produit complet
 */
async function processProduct(productUrl, forceMode = false) {
    stats.totalProducts++;
    
    const { sku, color, filename } = extractProductInfo(productUrl);
    
    if (!sku) {
        console.log(`   ⚠️ SKU non trouvé pour: ${productUrl}`);
        stats.skipped++;
        return;
    }
    
    // Vérifier combien d'images on a déjà
    const { count: existingCount } = await supabase
        .from('image_index')
        .select('*', { count: 'exact', head: true })
        .eq('model_ref', sku);
    
    if (!forceMode && existingCount >= 2) {
        // Déjà assez d'images
        stats.skipped++;
        return;
    }
    
    console.log(`\n🔍 [${stats.totalProducts}] ${sku} (${color || 'N/A'}) - ${existingCount || 0} images existantes`);
    
    // Scraper les images
    const { found, images, pageSku, error } = await scrapeProductImages(productUrl);
    
    if (!found) {
        if (error) {
            console.log(`   ❌ Erreur: ${error}`);
            stats.errors++;
        } else {
            console.log(`   ⚠️ Page non trouvée`);
            stats.notFound++;
        }
        return;
    }
    
    if (images.length === 0) {
        console.log(`   ⚠️ Aucune image trouvée`);
        stats.skipped++;
        return;
    }
    
    // Utiliser le SKU de la page si trouvé
    const finalSku = pageSku || sku;
    
    console.log(`   📸 ${images.length} images trouvées`);
    
    // Télécharger et uploader chaque image
    let uploadedCount = 0;
    for (let i = 0; i < images.length && i < 10; i++) { // Max 10 images par produit
        const result = await downloadAndUploadImage(images[i], finalSku, color, i + 1);
        
        if (result.success) {
            uploadedCount++;
            stats.imagesUploaded++;
            console.log(`   ✅ ${result.filename}`);
        } else if (result.reason !== 'exists') {
            console.log(`   ❌ ${result.reason}`);
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
    console.log('🚀 Scraping GlobalOnline - TOUTES LES IMAGES');
    console.log('='.repeat(60));
    
    const forceMode = process.argv.includes('--force');
    if (forceMode) {
        console.log('⚠️ Mode FORCE activé');
    }
    
    // Collecter tous les liens produits de toutes les catégories
    const allProductLinks = new Set();
    
    for (const categoryUrl of CATEGORIES) {
        try {
            const links = await scrapeProductLinksFromCategory(categoryUrl);
            links.forEach(link => allProductLinks.add(link));
            console.log(`   ✅ Total unique: ${allProductLinks.size} produits`);
        } catch (error) {
            console.error(`   ❌ Erreur catégorie:`, error.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 ${allProductLinks.size} produits uniques trouvés dans ${stats.categoriesScraped} catégories`);
    console.log('='.repeat(60));
    
    // Traiter chaque produit
    const productArray = Array.from(allProductLinks);
    
    for (let i = 0; i < productArray.length; i++) {
        await processProduct(productArray[i], forceMode);
        
        // Progression tous les 50 produits
        if (i > 0 && i % 50 === 0) {
            console.log(`\n📈 Progression: ${i}/${productArray.length} (${Math.round(i/productArray.length*100)}%)`);
            console.log(`   Images uploadées: ${stats.imagesUploaded}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Résumé final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ FINAL');
    console.log('='.repeat(60));
    console.log(`📁 Catégories scrapées:    ${stats.categoriesScraped}`);
    console.log(`📝 Produits traités:       ${stats.totalProducts}`);
    console.log(`✅ Produits avec images:   ${stats.productsWithNewImages}`);
    console.log(`📸 Images uploadées:       ${stats.imagesUploaded}`);
    console.log(`⏭️  Produits ignorés:       ${stats.skipped}`);
    console.log(`🔍 Non trouvés:            ${stats.notFound}`);
    console.log(`❌ Erreurs:                ${stats.errors}`);
    console.log('='.repeat(60));
    console.log('\n✅ Scraping terminé!');
}

main().catch(console.error);

