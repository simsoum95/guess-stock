#!/usr/bin/env node
/**
 * Script pour scraper les images de GlobalOnline pour VILEBREQUIN et SAM EDELMAN
 * 
 * Ce script :
 * 1. Récupère les model_ref existants depuis image_index (VILEBREQUIN et SAM EDELMAN)
 * 2. Pour chaque code sans assez d'images, va sur https://globalonline.co.il/{code}
 * 3. Extrait toutes les URLs d'images du produit
 * 4. Télécharge et uploade sur Supabase Storage
 * 5. Indexe dans la table image_index
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

// Stats globales
const stats = {
    totalProducts: 0,
    productsWithNewImages: 0,
    imagesDownloaded: 0,
    imagesUploaded: 0,
    errors: 0,
    skipped: 0,
    notFound: 0
};

/**
 * Récupère les codes produits VILEBREQUIN et SAM EDELMAN existants
 */
async function getExistingModelRefs() {
    console.log('📋 Récupération des codes produits existants...');
    
    // Récupérer tous les model_ref qui commencent par des préfixes VILEBREQUIN ou SAM EDELMAN
    const prefixes = [
        'JIMC', 'JIMA', 'JIHI', 'JIIA', 'JOIU', 'BMBA', 'CPPA', 'PYRE', // VILEBREQUIN
        'HBSE', 'FESE', 'SBSE' // SAM EDELMAN
    ];
    
    const allModelRefs = new Set();
    
    for (const prefix of prefixes) {
        const { data, error } = await supabase
            .from('image_index')
            .select('model_ref')
            .ilike('model_ref', `${prefix}%`);
        
        if (data) {
            data.forEach(row => allModelRefs.add(row.model_ref));
        }
    }
    
    console.log(`   ✅ ${allModelRefs.size} codes uniques trouvés`);
    return Array.from(allModelRefs);
}

/**
 * Compte les images existantes pour un model_ref
 */
async function countExistingImages(modelRef) {
    const { count, error } = await supabase
        .from('image_index')
        .select('*', { count: 'exact', head: true })
        .eq('model_ref', modelRef);
    
    return count || 0;
}

/**
 * Scrape les images d'un produit depuis GlobalOnline
 */
async function scrapeProductImages(productCode) {
    const url = `https://www.globalonline.co.il/${productCode.toLowerCase()}`;
    
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
                return { found: false, images: [] };
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const images = new Set();
        
        // 1. Images de la galerie principale (haute qualité)
        $('img[src*="/media/catalog/product"]').each((_, el) => {
            let src = $(el).attr('src');
            if (src && !src.includes('placeholder') && !src.includes('swatch')) {
                // Convertir en URL de haute qualité
                if (src.includes('/cache/')) {
                    // Ex: /media/catalog/product/cache/xxx/j/i/jimc3b27_390_1_1.jpg
                    // -> /media/catalog/product/j/i/jimc3b27_390_1_1.jpg
                    src = src.replace(/\/cache\/[^/]+\//, '/');
                }
                if (src.startsWith('/')) src = `https://www.globalonline.co.il${src}`;
                images.add(src);
            }
        });
        
        // 2. Chercher dans les scripts la configuration de la galerie
        $('script').each((_, el) => {
            const content = $(el).html() || '';
            
            // Chercher les URLs d'images dans le JSON
            const imgMatches = content.matchAll(/"(?:img|full|thumb|image)":\s*"([^"]+media\/catalog\/product[^"]+)"/g);
            for (const match of imgMatches) {
                let imgUrl = match[1].replace(/\\\//g, '/');
                if (imgUrl.startsWith('/')) imgUrl = `https://www.globalonline.co.il${imgUrl}`;
                images.add(imgUrl);
            }
        });
        
        // 3. Images dans les data attributes
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
        
        return { found: true, images: Array.from(uniqueByFilename.values()) };
    } catch (error) {
        return { found: false, images: [], error: error.message };
    }
}

/**
 * Télécharge une image et l'uploade sur Supabase
 */
async function downloadAndUploadImage(imageUrl, modelRef, index, forceMode = false) {
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
        
        // Déterminer la couleur depuis le nom de fichier
        // Ex: jimc3b27_390_1_1.jpg -> 390
        let color = 'DEFAULT';
        const filenameParts = originalFilename.replace(/\.[^.]+$/, '').split(/[_-]/);
        if (filenameParts.length >= 2) {
            // Prendre le deuxième segment comme couleur potentielle
            const potentialColor = filenameParts[1];
            if (potentialColor && potentialColor.length <= 10) {
                color = potentialColor.toUpperCase();
            }
        }
        
        // Créer un nom de fichier unique
        const ext = path.extname(originalFilename) || '.jpg';
        const filename = `${modelRef}_${color}_${index}${ext}`.toUpperCase();
        const storagePath = filename;
        
        // Vérifier si l'image existe déjà (sauf en mode force)
        if (!forceMode) {
            const { data: existingImage } = await supabase
                .from('image_index')
                .select('id')
                .eq('filename', filename)
                .single();
            
            if (existingImage) {
                return { success: false, reason: 'exists', filename };
            }
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
                color: color,
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
 * Traite un produit : scrape et uploade les images
 */
async function processProduct(modelRef, minImages = 1, forceMode = false) {
    stats.totalProducts++;
    
    // Vérifier combien d'images on a déjà
    const existingCount = await countExistingImages(modelRef);
    
    // En mode force, on ne saute pas même si on a des images
    // Sinon, on saute si on a déjà assez d'images
    if (!forceMode && existingCount >= minImages) {
        stats.skipped++;
        return;
    }
    
    console.log(`\n🔍 Scraping ${modelRef}... (${existingCount} images existantes)`);
    
    // Scraper les images
    const { found, images, error } = await scrapeProductImages(modelRef);
    
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
    
    if (images.length === 0) {
        console.log(`   ⚠️ Aucune nouvelle image trouvée`);
        stats.skipped++;
        return;
    }
    
    console.log(`   📸 ${images.length} images trouvées sur GlobalOnline`);
    
    // Télécharger et uploader chaque image
    let uploadedCount = 0;
    for (let i = 0; i < images.length; i++) {
        const result = await downloadAndUploadImage(images[i], modelRef, i + 1, forceMode);
        
        if (result.success) {
            uploadedCount++;
            stats.imagesUploaded++;
            console.log(`   ✅ Uploadé: ${result.filename}`);
        } else if (result.reason === 'exists') {
            // Image existe déjà
        } else {
            console.log(`   ❌ Échec upload: ${result.reason}`);
        }
        
        // Petite pause pour éviter de surcharger le serveur
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    if (uploadedCount > 0) {
        stats.productsWithNewImages++;
        console.log(`   ✅ ${uploadedCount} nouvelles images ajoutées`);
    }
}

/**
 * Scrape une page de catégorie pour trouver tous les codes produits
 */
async function scrapeProductCodesFromCategory(categoryUrl) {
    console.log(`\n📋 Scraping codes produits depuis ${categoryUrl}...`);
    
    const codes = new Set();
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 50) { // Max 50 pages
        const url = page === 1 ? categoryUrl : `${categoryUrl}?p=${page}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });
            
            if (!response.ok) {
                hasMore = false;
                continue;
            }
            
            const html = await response.text();
            const $ = cheerio.load(html);
            
            // Chercher les liens vers les produits
            $('a[href*="globalonline.co.il/"]').each((_, el) => {
                const href = $(el).attr('href');
                if (href) {
                    // Extraire le code du produit de l'URL
                    // Ex: https://www.globalonline.co.il/jimc3b27 -> JIMC3B27
                    // Ex: https://www.globalonline.co.il/hbse-325-0007 -> HBSE-325-0007
                    const match = href.match(/globalonline\.co\.il\/([a-zA-Z0-9-]+)(?:\?|$|\.html)/);
                    if (match && match[1].length >= 5 && match[1].length <= 20) {
                        const code = match[1].toUpperCase();
                        // Filtrer les codes qui ressemblent à des produits VILEBREQUIN ou SAM EDELMAN
                        if (code.match(/^(JIM|JII|JHI|JOI|BMB|CPP|PYR|HBSE|FESE|SBSE)/)) {
                            codes.add(code);
                        }
                    }
                }
            });
            
            // Vérifier s'il y a une page suivante
            const hasNextPage = $('a.action.next, .pages-item-next a').length > 0;
            hasMore = hasNextPage;
            page++;
            
            console.log(`   Page ${page - 1}: ${codes.size} codes trouvés jusqu'à présent`);
            
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`   ❌ Erreur page ${page}:`, error.message);
            hasMore = false;
        }
    }
    
    return Array.from(codes);
}

/**
 * Fonction principale
 */
async function main() {
    console.log('🚀 Démarrage du scraping GlobalOnline');
    console.log('=' .repeat(60));
    console.log('📌 Marques: VILEBREQUIN, SAM EDELMAN');
    console.log('=' .repeat(60));
    
    // Arguments
    const forceRefresh = process.argv.includes('--force');
    const scrapeCategories = process.argv.includes('--categories');
    const minImages = parseInt(process.argv.find(a => a.startsWith('--min='))?.split('=')[1] || '2');
    
    if (forceRefresh) {
        console.log('⚠️ Mode FORCE: toutes les images seront re-téléchargées');
    }
    
    let productCodes = [];
    
    if (scrapeCategories) {
        // Scraper les pages de catégories pour trouver les codes
        const categories = [
            'https://www.globalonline.co.il/vilebrequin',
            'https://www.globalonline.co.il/sam-edelman'
        ];
        
        for (const cat of categories) {
            const codes = await scrapeProductCodesFromCategory(cat);
            productCodes.push(...codes);
        }
        
        // Dédupliquer
        productCodes = [...new Set(productCodes)];
    } else {
        // Utiliser les codes existants dans la base de données
        productCodes = await getExistingModelRefs();
    }
    
    console.log(`\n📊 Total: ${productCodes.length} codes produits à traiter`);
    console.log(`📌 Minimum d'images requis: ${minImages}`);
    console.log('=' .repeat(60));
    
    // Traiter chaque produit
    for (let i = 0; i < productCodes.length; i++) {
        const code = productCodes[i];
        
        // Afficher la progression
        if (i % 20 === 0 && i > 0) {
            console.log(`\n📈 Progression: ${i}/${productCodes.length} (${Math.round(i/productCodes.length*100)}%)`);
        }
        
        await processProduct(code, minImages, forceRefresh);
        
        // Pause entre chaque produit
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Résumé final
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('=' .repeat(60));
    console.log(`📝 Produits traités:      ${stats.totalProducts}`);
    console.log(`✅ Produits avec images:  ${stats.productsWithNewImages}`);
    console.log(`📸 Images uploadées:      ${stats.imagesUploaded}`);
    console.log(`⏭️  Produits ignorés:      ${stats.skipped}`);
    console.log(`🔍 Non trouvés:           ${stats.notFound}`);
    console.log(`❌ Erreurs:               ${stats.errors}`);
    console.log('=' .repeat(60));
    console.log('\n✅ Scraping terminé!');
}

main().catch(console.error);
