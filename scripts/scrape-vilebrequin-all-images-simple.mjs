#!/usr/bin/env node
/**
 * Script SIMPLIFIÉ pour scraper TOUTES les images VILEBREQUIN
 * 
 * Ce script :
 * 1. Récupère TOUS les produits VILEBREQUIN depuis image_index
 * 2. Pour chaque produit, récupère TOUTES les images depuis GlobalOnline
 * 3. Groupe les images par code couleur trouvé dans le nom de fichier
 * 4. Upload toutes les images avec le bon nom de couleur
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
    '603': 'BLEU CIEL', // Code spécifique pour certains produits VILEBREQUIN
};

// Stats
const stats = {
    totalProducts: 0,
    productsProcessed: 0,
    imagesDownloaded: 0,
    imagesUploaded: 0,
    errors: 0,
};

/**
 * Récupère TOUS les produits VILEBREQUIN depuis image_index
 */
async function getAllVilebrequinProducts() {
    console.log('📋 Récupération des produits VILEBREQUIN...');
    
    const prefixes = [
        'JIMC', 'JIMA', 'JIHI', 'JIIA', 'JOIU', 'BMBA', 'CPPA', 'PYRE', 
        'PLTH', 'CRSH', 'CRSC', 'CRSU', 'FLCC', 'FLEC', 'FLRC', 'FLCH',
        'FLAC', 'ACKC', 'FLAU', 'MO', 'JI', 'FL', 'AC', 'BM', 'LO', 'MA', 'MT'
    ];
    
    const allModelRefs = new Set();
    
    for (const prefix of prefixes) {
        const { data } = await supabase
            .from('image_index')
            .select('model_ref')
            .ilike('model_ref', `${prefix}%`);
        
        if (data) {
            data.forEach(row => allModelRefs.add(row.model_ref));
        }
    }
    
    console.log(`   ✅ ${allModelRefs.size} produits trouvés`);
    return Array.from(allModelRefs);
}

/**
 * Scrape TOUTES les images depuis GlobalOnline
 */
async function scrapeAllImages(modelRef) {
    const url = `https://www.globalonline.co.il/${modelRef.toLowerCase()}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });
        
        if (!response.ok) {
            return { found: false, images: [] };
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const allImageUrls = new Set();
        
        // 1. Images dans les balises img
        $('img').each((_, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
            if (src && src.includes('/media/catalog/product')) {
                if (src.includes('/cache/')) {
                    src = src.replace(/\/cache\/[^/]+\//, '/');
                }
                if (src.startsWith('/')) {
                    src = `https://www.globalonline.co.il${src}`;
                }
                if (!src.includes('placeholder') && !src.includes('swatch') && !src.includes('icon')) {
                    allImageUrls.add(src);
                }
            }
        });
        
        // 2. Chercher dans TOUS les scripts (amélioré pour trouver toutes les variantes)
        $('script').each((_, el) => {
            const content = $(el).html() || '';
            
            // Chercher les configurations de galerie complètes avec toutes les images
            // Format: "gallery": { "images": [...] }
            const galleryMatches = content.matchAll(/"gallery":\s*\{[^}]*"images":\s*\[([^\]]+)\]/g);
            for (const match of galleryMatches) {
                const imagesJson = match[1];
                // Chercher toutes les variantes (full, img, thumb, etc.)
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
                            !imgUrl.includes('swatch') && 
                            !imgUrl.includes('icon')) {
                            // Enlever le cache pour avoir l'image originale
                            if (imgUrl.includes('/cache/')) {
                                imgUrl = imgUrl.replace(/\/cache\/[^/]+\//, '/');
                            }
                            allImageUrls.add(imgUrl);
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
                    if (!imgUrl.includes('placeholder') && !imgUrl.includes('swatch') && !imgUrl.includes('icon')) {
                        if (imgUrl.includes('/cache/')) {
                            imgUrl = imgUrl.replace(/\/cache\/[^/]+\//, '/');
                        }
                        allImageUrls.add(imgUrl);
                    }
                }
            }
            
            // Chercher toutes les URLs d'images (absolues et relatives)
            const matches = content.matchAll(/(https?:\/\/[^"'\s]+\/media\/catalog\/product[^"'\s]+\.(jpg|jpeg|png|webp))/gi);
            for (const match of matches) {
                let imgUrl = match[1];
                if (!imgUrl.includes('placeholder') && !imgUrl.includes('swatch') && !imgUrl.includes('icon')) {
                    if (imgUrl.includes('/cache/')) {
                        imgUrl = imgUrl.replace(/\/cache\/[^/]+\//, '/');
                    }
                    allImageUrls.add(imgUrl);
                }
            }
            
            // Chercher les URLs relatives
            const relMatches = content.matchAll(/(\/media\/catalog\/product[^"'\s]+\.(jpg|jpeg|png|webp))/gi);
            for (const match of relMatches) {
                let imgUrl = `https://www.globalonline.co.il${match[1]}`;
                if (!imgUrl.includes('placeholder') && !imgUrl.includes('swatch') && !imgUrl.includes('icon')) {
                    if (imgUrl.includes('/cache/')) {
                        imgUrl = imgUrl.replace(/\/cache\/[^/]+\//, '/');
                    }
                    allImageUrls.add(imgUrl);
                }
            }
            
            // Chercher les patterns spécifiques avec le model_ref et code couleur
            // Format: "JIIAF136_603_1.jpg" ou "JIIAF136_603_2.jpg"
            const modelRefPattern = new RegExp(`"${modelRef.toLowerCase()}_(\\d{3})_(\\d+)\\.(jpg|jpeg|png|webp)"`, 'gi');
            const modelMatches = content.matchAll(modelRefPattern);
            for (const match of modelMatches) {
                const colorCode = match[1];
                const index = match[2];
                const ext = match[3];
                // Construire l'URL de l'image
                const firstLetter = modelRef.charAt(0);
                const secondLetter = modelRef.charAt(1);
                const imgUrl = `https://www.globalonline.co.il/media/catalog/product/${firstLetter}/${secondLetter}/${modelRef}_${colorCode}_${index}.${ext}`;
                allImageUrls.add(imgUrl);
            }
        });
        
        // Si on n'a pas trouvé beaucoup d'images, essayer de construire les URLs directement
        // en utilisant le pattern observé : modelref_colorcode_index.jpg
        // MAIS seulement pour les codes couleur trouvés dans le HTML
        if (allImageUrls.size < 3) {
            console.log(`   🔧 Tentative de construction d'URLs directes...`);
            
            // D'abord, chercher les codes couleur dans le HTML/scripts
            const foundColorCodes = new Set();
            
            // Chercher dans les scripts les codes couleur utilisés
            $('script').each((_, el) => {
                const content = $(el).html() || '';
                // Chercher les patterns comme "JIIAF136_603_1.jpg" ou "603"
                const colorMatches = content.matchAll(new RegExp(`${modelRef.toLowerCase()}_(\\d{3})_\\d+\\.(jpg|jpeg|png)`, 'gi'));
                for (const match of colorMatches) {
                    foundColorCodes.add(match[1]);
                }
                
                // Chercher aussi dans les URLs d'images
                const urlMatches = content.matchAll(/\/media\/catalog\/product\/[^/]+\/[^/]+\/([^_]+)_(\d{3})_(\d+)\.(jpg|jpeg|png)/gi);
                for (const match of urlMatches) {
                    if (match[1].toUpperCase() === modelRef) {
                        foundColorCodes.add(match[2]);
                    }
                }
            });
            
            // Chercher aussi dans les balises img
            $('img[src*="/media/catalog/product"]').each((_, el) => {
                const src = $(el).attr('src') || '';
                const match = src.match(/\/([^/]+)_(\d{3})_(\d+)\.(jpg|jpeg|png)/i);
                if (match && match[1].toUpperCase() === modelRef) {
                    foundColorCodes.add(match[2]);
                }
            });
            
            // Si on n'a pas trouvé de codes couleur, NE PAS construire d'URLs au hasard
            // On retourne seulement les images trouvées dans le HTML
            if (foundColorCodes.size === 0) {
                console.log(`   ⚠️ Aucun code couleur trouvé dans le HTML`);
                return { found: true, images: Array.from(allImageUrls) };
            }
            
            const colorCodesToTry = Array.from(foundColorCodes);
            console.log(`   📋 Codes couleur trouvés: ${colorCodesToTry.join(', ')}`);
            
            // Construire le chemin de base
            const firstLetter = modelRef.charAt(0);
            const secondLetter = modelRef.charAt(1);
            const basePath = `https://www.globalonline.co.il/media/catalog/product/${firstLetter}/${secondLetter}`;
            
            // Essayer différents codes couleur et indices (jusqu'à 10 images par couleur)
            for (const colorCode of colorCodesToTry) {
                let foundCount = 0;
                // Essayer jusqu'à 10 images, mais s'arrêter si on ne trouve rien pendant 3 tentatives consécutives
                let consecutiveFailures = 0;
                for (let i = 1; i <= 10 && consecutiveFailures < 3; i++) {
                    // Essayer seulement .jpg d'abord (le format le plus commun)
                    const url = `${basePath}/${modelRef}_${colorCode}_${i}.jpg`;
                    
                    try {
                        const headResponse = await fetch(url, { 
                            method: 'HEAD',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            }
                        });
                        // Vérifier que l'image existe ET qu'elle n'est pas trop petite (probablement blanche)
                        if (headResponse.ok) {
                            const contentLength = headResponse.headers.get('content-length');
                            if (contentLength && parseInt(contentLength) > 5000) {
                                allImageUrls.add(url);
                                foundCount++;
                                consecutiveFailures = 0; // Réinitialiser le compteur
                            } else {
                                consecutiveFailures++;
                            }
                        } else {
                            consecutiveFailures++;
                        }
                    } catch (e) {
                        consecutiveFailures++;
                    }
                }
            }
        }
        
        return { found: true, images: Array.from(allImageUrls) };
    } catch (error) {
        return { found: false, images: [], error: error.message };
    }
}

/**
 * Groupe les images par couleur en utilisant le nom de fichier
 */
function groupImagesByColor(images, modelRef) {
    const imagesByColor = new Map();
    
    for (const imgUrl of images) {
        const filename = imgUrl.split('/').pop();
        const filenameParts = filename.replace(/\.[^.]+$/, '').split(/[_-]/);
        
        // Chercher le code couleur (3 chiffres) dans le nom de fichier
        let colorCode = null;
        let colorName = 'DEFAULT';
        
        // Format: modelref_390_1_1.jpg ou modelref_390_1.jpg
        for (let i = 1; i < filenameParts.length; i++) {
            const part = filenameParts[i];
            if (/^\d{3}$/.test(part)) {
                // C'est un code couleur
                colorCode = part;
                colorName = COLOR_CODE_MAP[colorCode] || colorCode;
                break;
            }
        }
        
        // Si pas de code couleur trouvé, essayer de trouver un nom de couleur
        if (colorName === 'DEFAULT') {
            for (let i = 1; i < filenameParts.length; i++) {
                const part = filenameParts[i];
                // Ignorer les nombres simples (1, 2, etc.) et le model_ref
                if (part !== modelRef.toLowerCase() && !/^\d{1,2}$/.test(part) && part.length >= 2) {
                    colorName = part.toUpperCase();
                    break;
                }
            }
        }
        
        if (!imagesByColor.has(colorName)) {
            imagesByColor.set(colorName, []);
        }
        imagesByColor.get(colorName).push(imgUrl);
    }
    
    return imagesByColor;
}

/**
 * Télécharge et upload une image
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
        
        // Vérifier que l'image n'est pas vide (taille minimale 5KB pour éviter les images blanches)
        if (buffer.length < 5000) {
            throw new Error('Image trop petite (probablement vide ou blanche)');
        }
        
        // Vérifier que c'est une image valide
        // Les images JPEG valides commencent par FF D8
        // Les images PNG commencent par 89 50 4E 47
        // Les images WebP commencent par RIFF...WEBP
        const firstBytes = buffer.slice(0, 4);
        const isJPEG = firstBytes[0] === 0xFF && firstBytes[1] === 0xD8;
        const isPNG = firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4E && firstBytes[3] === 0x47;
        const isWebP = buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP';
        
        if (!isJPEG && !isPNG && !isWebP) {
            throw new Error('Image invalide (format non reconnu)');
        }
        
        const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)$/i)?.[1] || 'jpg';
        const filename = `${modelRef}_${color.replace(/\s+/g, '_')}_${index}.${ext}`.toUpperCase();
        
        // Vérifier si existe déjà
        const { data: existing } = await supabase
            .from('image_index')
            .select('id')
            .eq('filename', filename)
            .single();
        
        if (existing) {
            return { success: false, reason: 'exists', filename };
        }
        
        // Uploader
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
        
        // Indexer
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
            console.warn(`   ⚠️ Indexation échouée: ${indexError.message}`);
        }
        
        stats.imagesDownloaded++;
        stats.imagesUploaded++;
        
        return { success: true, filename, url: publicUrl };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

/**
 * Traite un produit
 */
async function processProduct(modelRef) {
    stats.totalProducts++;
    
    console.log(`\n🔍 ${modelRef}...`);
    
    // Scraper toutes les images
    const { found, images, error } = await scrapeAllImages(modelRef);
    
    if (!found) {
        if (error) {
            console.log(`   ❌ Erreur: ${error}`);
            stats.errors++;
        } else {
            console.log(`   ⚠️ Produit non trouvé`);
        }
        return;
    }
    
    if (images.length === 0) {
        console.log(`   ⚠️ Aucune image trouvée`);
        return;
    }
    
    console.log(`   📸 ${images.length} images trouvées`);
    
    // Grouper par couleur
    const imagesByColor = groupImagesByColor(images, modelRef);
    
    console.log(`   🎨 ${imagesByColor.size} couleurs identifiées`);
    
    let totalUploaded = 0;
    
    // Uploader toutes les images pour chaque couleur
    for (const [color, colorImages] of imagesByColor.entries()) {
        console.log(`      ${color}: ${colorImages.length} images`);
        
        for (let i = 0; i < colorImages.length; i++) {
            const result = await downloadAndUploadImage(colorImages[i], modelRef, color, i + 1);
            
            if (result.success) {
                totalUploaded++;
                console.log(`         ✅ ${result.filename}`);
            } else if (result.reason !== 'exists') {
                console.log(`         ❌ ${result.reason}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    if (totalUploaded > 0) {
        stats.productsProcessed++;
        console.log(`   ✅ ${totalUploaded} nouvelles images ajoutées`);
    }
}

/**
 * Main
 */
async function main() {
    console.log('🚀 Scraping COMPLET VILEBREQUIN');
    console.log('='.repeat(60));
    
    const products = await getAllVilebrequinProducts();
    
    if (products.length === 0) {
        console.log('⚠️ Aucun produit trouvé');
        return;
    }
    
    // Filtrer pour test si fourni
    const testProduct = process.argv.find(arg => arg.startsWith('--test='))?.split('=')[1];
    let productsToProcess = products;
    
    if (testProduct) {
        const testModelRef = testProduct.toUpperCase();
        productsToProcess = products.filter(p => p === testModelRef);
        if (productsToProcess.length === 0) {
            // En mode test, on peut tester n'importe quel produit même s'il n'est pas dans image_index
            console.log(`🧪 Mode test: ${testModelRef} (ajouté pour test)\n`);
            productsToProcess = [testModelRef];
        } else {
            console.log(`🧪 Mode test: ${testModelRef}\n`);
        }
    }
    
    console.log(`📊 ${productsToProcess.length} produits à traiter\n`);
    
    for (let i = 0; i < productsToProcess.length; i++) {
        await processProduct(productsToProcess[i]);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`📝 Produits: ${stats.totalProducts}`);
    console.log(`✅ Traités: ${stats.productsProcessed}`);
    console.log(`📸 Images: ${stats.imagesUploaded}`);
    console.log(`❌ Erreurs: ${stats.errors}`);
    console.log('='.repeat(60));
}

main().catch(console.error);

