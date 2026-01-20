#!/usr/bin/env node
/**
 * Script COMPLET pour corriger TOUTES les images VILEBREQUIN et SAM EDELMAN
 * 
 * Ce script :
 * 1. Récupère TOUS les modelRef uniques depuis image_index
 * 2. Pour chaque produit, va sur GlobalOnline pour trouver les couleurs disponibles
 * 3. Télécharge toutes les images avec les bons noms de couleur
 * 4. Met à jour l'index dans Supabase
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables Supabase manquantes');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =============================================================================
// MAPPING CODES COULEUR GLOBALONLINE → NOMS FRANÇAIS
// =============================================================================
const COLOR_CODE_TO_NAME = {
    '010': 'BLANC',
    '100': 'BLANC',
    '101': 'BLANC CASSE',
    '300': 'BLEU CIEL',
    '315': 'BLEU',
    '329': 'BLEU',
    '350': 'BLEU',
    '390': 'BLEU MARINE',
    '399': 'BLEU MARINE',
    '402': 'VERT',
    '410': 'VERT',
    '430': 'VERT',
    '432': 'VERT FONCE',
    '501': 'JAUNE',
    '514': 'JAUNE',
    '520': 'ORANGE',
    '540': 'ORANGE',
    '601': 'ROUGE',
    '602': 'ROUGE',
    '621': 'ROSE',
    '650': 'ROSE',
    '710': 'VIOLET',
    '750': 'GRIS',
    '780': 'GRIS FONCE',
    '800': 'MARRON',
    '990': 'NOIR',
    '999': 'NOIR',
};

// Préfixes des produits VILEBREQUIN et SAM EDELMAN
const PRODUCT_PREFIXES = [
    // VILEBREQUIN (maillots, polos, chemises)
    'PL', 'PY', 'CR', 'MO', 'JI', 'AC', 'BM', 'FC', 'FL',
    // SAM EDELMAN (sacs)
    'HBSE', 'FESE', 'SBSE', 'E85'
];

const stats = {
    productsProcessed: 0,
    productsSkipped: 0,
    imagesUploaded: 0,
    imagesDeleted: 0,
    errors: 0,
};

/**
 * Récupère tous les modelRef uniques pour VILEBREQUIN et SAM EDELMAN
 */
async function getAllModelRefs() {
    const { data, error } = await supabase
        .from('image_index')
        .select('model_ref')
        .order('model_ref');
    
    if (error) throw error;
    
    // Filtrer pour ne garder que VILEBREQUIN et SAM EDELMAN
    const modelRefs = [...new Set(data.map(d => d.model_ref))];
    
    return modelRefs.filter(ref => {
        if (!ref) return false;
        return PRODUCT_PREFIXES.some(prefix => ref.toUpperCase().startsWith(prefix));
    });
}

/**
 * Scrape les couleurs disponibles depuis GlobalOnline
 */
async function scrapeColorsFromGlobalOnline(modelRef) {
    const url = `https://www.globalonline.co.il/${modelRef.toLowerCase()}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });
        
        if (!response.ok) {
            return null;
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const colors = [];
        
        // Méthode 1: Chercher les options de couleur avec data-option-label
        $('[data-option-label]').each((i, el) => {
            const colorName = $(el).attr('data-option-label');
            if (colorName && !colors.find(c => c.name === colorName)) {
                colors.push({ name: colorName.toUpperCase() });
            }
        });
        
        // Méthode 2: Chercher dans les images pour extraire les codes couleur
        const imageUrls = [];
        $('img[src*="' + modelRef + '"]').each((i, el) => {
            imageUrls.push($(el).attr('src'));
        });
        
        // Extraire les codes couleur des URLs d'images
        const colorCodesFound = new Set();
        const regex = new RegExp(`${modelRef.toUpperCase()}_([0-9]{3})_`, 'i');
        
        // Chercher aussi dans tout le HTML
        const matches = html.matchAll(new RegExp(`${modelRef.toUpperCase()}_([0-9]{3})_\\d+`, 'gi'));
        for (const match of matches) {
            colorCodesFound.add(match[1]);
        }
        
        // Convertir les codes en noms
        for (const code of colorCodesFound) {
            const name = COLOR_CODE_TO_NAME[code];
            if (name && !colors.find(c => c.name === name)) {
                colors.push({ code, name });
            }
        }
        
        // Si on n'a trouvé aucune couleur, essayer de récupérer les variations
        if (colors.length === 0) {
            // Chercher dans le JSON de configuration
            const jsonMatch = html.match(/\\"jsonConfig\\":({.*?})\s*,\s*\\"/);
            if (jsonMatch) {
                try {
                    const decoded = jsonMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                    const jsonData = JSON.parse(decoded);
                    // Extraire les couleurs du JSON
                } catch (e) {}
            }
        }
        
        return colors.length > 0 ? colors : null;
    } catch (error) {
        console.error(`   ⚠️ Erreur lors du scraping de ${modelRef}: ${error.message}`);
        return null;
    }
}

/**
 * Essaie différents patterns d'URL pour trouver les images
 */
async function findWorkingImageUrls(modelRef, colorCode) {
    const patterns = [
        // Pattern avec cache
        (mr, cc, idx) => `https://www.globalonline.co.il/media/catalog/product/cache/4445b38ba39c4c595346ee41e84dd066/${mr[0]}/${mr[1]}/${mr}_${cc}_${idx}_2.jpg`,
        // Pattern direct
        (mr, cc, idx) => `https://www.globalonline.co.il/media/catalog/product/${mr[0]}/${mr[1]}/${mr}_${cc}_${idx}_2.jpg`,
        // Pattern avec cache alternatif
        (mr, cc, idx) => `https://www.globalonline.co.il/media/catalog/product/cache/1/image/1200x/040ec09b1e35df139433887a97daa66f/${mr[0]}/${mr[1]}/${mr}_${cc}_${idx}_2.jpg`,
    ];
    
    const mr = modelRef.toUpperCase();
    const workingUrls = [];
    
    for (const pattern of patterns) {
        const testUrl = pattern(mr, colorCode, 1);
        try {
            const response = await fetch(testUrl, { method: 'HEAD' });
            if (response.ok) {
                // Ce pattern fonctionne, récupérer toutes les images
                for (let i = 1; i <= 6; i++) {
                    const url = pattern(mr, colorCode, i);
                    const check = await fetch(url, { method: 'HEAD' });
                    if (check.ok) {
                        workingUrls.push({ url, index: i });
                    } else {
                        break; // Plus d'images pour cette couleur
                    }
                }
                return workingUrls;
            }
        } catch (e) {}
    }
    
    return workingUrls;
}

/**
 * Supprime toutes les images existantes pour un modelRef
 */
async function deleteExistingImages(modelRef) {
    const { data: existing, error } = await supabase
        .from('image_index')
        .select('id, filename')
        .eq('model_ref', modelRef.toUpperCase());
    
    if (error || !existing || existing.length === 0) return 0;
    
    // Supprimer du storage
    const filenames = existing.map(e => e.filename).filter(f => f);
    if (filenames.length > 0) {
        await supabase.storage.from('guess-images').remove(filenames);
    }
    
    // Supprimer de l'index
    const ids = existing.map(e => e.id);
    await supabase.from('image_index').delete().in('id', ids);
    
    return existing.length;
}

/**
 * Télécharge et uploade une image
 */
async function downloadAndUploadImage(imageUrl, modelRef, colorName, index) {
    try {
        const response = await fetch(imageUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*',
            },
        });
        
        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
        }
        
        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Vérifier taille minimale
        if (buffer.length < 1000) {
            return { success: false, error: 'Image trop petite' };
        }
        
        // Nom de fichier
        const safeColor = colorName.replace(/\s+/g, '_');
        const filename = `${modelRef.toUpperCase()}_${safeColor}_${index}.JPG`;
        
        // Upload
        const { error: uploadError } = await supabase.storage
            .from('guess-images')
            .upload(filename, buffer, {
                contentType: 'image/jpeg',
                upsert: true
            });
        
        if (uploadError) throw new Error(uploadError.message);
        
        // URL publique
        const { data: { publicUrl } } = supabase.storage
            .from('guess-images')
            .getPublicUrl(filename);
        
        // Indexer
        await supabase.from('image_index').upsert({
            model_ref: modelRef.toUpperCase(),
            color: colorName,
            filename: filename,
            url: publicUrl,
            created_at: new Date().toISOString()
        }, { onConflict: 'filename' });
        
        return { success: true, filename };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Traite un produit complet
 */
async function processProduct(modelRef) {
    console.log(`\n🔍 ${modelRef}`);
    
    // 1. Scraper les couleurs depuis GlobalOnline
    const colors = await scrapeColorsFromGlobalOnline(modelRef);
    
    if (!colors || colors.length === 0) {
        console.log(`   ⏭️ Pas de couleurs trouvées, ignoré`);
        stats.productsSkipped++;
        return;
    }
    
    console.log(`   🎨 ${colors.length} couleur(s) trouvée(s): ${colors.map(c => c.name).join(', ')}`);
    
    // 2. Supprimer les anciennes images
    const deleted = await deleteExistingImages(modelRef);
    if (deleted > 0) {
        console.log(`   🗑️ ${deleted} anciennes images supprimées`);
        stats.imagesDeleted += deleted;
    }
    
    // 3. Pour chaque couleur, trouver et télécharger les images
    for (const color of colors) {
        const colorCode = color.code || Object.entries(COLOR_CODE_TO_NAME).find(([k, v]) => v === color.name)?.[0];
        
        if (!colorCode) {
            console.log(`   ⚠️ Code couleur inconnu pour ${color.name}`);
            continue;
        }
        
        const imageUrls = await findWorkingImageUrls(modelRef, colorCode);
        
        if (imageUrls.length === 0) {
            console.log(`   ⚠️ Pas d'images trouvées pour ${color.name}`);
            continue;
        }
        
        console.log(`   📷 ${color.name}: ${imageUrls.length} image(s)`);
        
        for (const { url, index } of imageUrls) {
            const result = await downloadAndUploadImage(url, modelRef, color.name, index);
            if (result.success) {
                stats.imagesUploaded++;
            } else {
                console.log(`      ❌ Image ${index}: ${result.error}`);
                stats.errors++;
            }
            await new Promise(r => setTimeout(r, 100));
        }
    }
    
    stats.productsProcessed++;
}

/**
 * Corrige les produits qui ont déjà des codes de couleur numériques
 */
async function fixNumericColorCodes() {
    console.log('\n📋 Correction des codes couleur numériques...');
    
    // Trouver tous les enregistrements avec des codes numériques comme couleur
    const { data, error } = await supabase
        .from('image_index')
        .select('*')
        .filter('color', 'like', '%[0-9]%');
    
    if (error) {
        console.error('Erreur:', error);
        return;
    }
    
    // Filtrer les codes numériques purs (3 chiffres)
    const toFix = (data || []).filter(item => /^\d{3}$/.test(item.color));
    
    console.log(`   ${toFix.length} enregistrements à corriger`);
    
    for (const item of toFix) {
        const newColor = COLOR_CODE_TO_NAME[item.color];
        if (newColor) {
            await supabase
                .from('image_index')
                .update({ color: newColor })
                .eq('id', item.id);
            console.log(`   ✅ ${item.model_ref}: ${item.color} → ${newColor}`);
        }
    }
}

/**
 * Programme principal
 */
async function main() {
    console.log('🚀 CORRECTION COMPLÈTE VILEBREQUIN & SAM EDELMAN');
    console.log('='.repeat(60));
    
    // Étape 1: Corriger les codes numériques existants
    await fixNumericColorCodes();
    
    // Étape 2: Récupérer tous les modelRef
    console.log('\n📦 Récupération des produits...');
    const modelRefs = await getAllModelRefs();
    console.log(`   ${modelRefs.length} produits trouvés`);
    
    // Filtrer les produits qui ont besoin d'être corrigés
    // (ceux qui ont DEFAULT, NULL, le modelRef comme couleur, ou codes numériques)
    const { data: problematicProducts } = await supabase
        .from('image_index')
        .select('model_ref, color')
        .or('color.eq.DEFAULT,color.eq.NULL,color.like.%U05%');
    
    const problematicRefs = [...new Set((problematicProducts || []).map(p => p.model_ref))];
    const toProcess = modelRefs.filter(ref => {
        // Vérifier si c'est problématique
        return problematicRefs.includes(ref) || 
               ref.toUpperCase().startsWith('JI') || 
               ref.toUpperCase().startsWith('MO') ||
               ref.toUpperCase().startsWith('FL') ||
               ref.toUpperCase().startsWith('AC') ||
               ref.toUpperCase().startsWith('BM') ||
               ref.toUpperCase().startsWith('FC');
    });
    
    console.log(`   ${toProcess.length} produits à traiter`);
    
    // Traiter chaque produit
    let processed = 0;
    for (const modelRef of toProcess) {
        await processProduct(modelRef);
        processed++;
        
        // Progress
        if (processed % 10 === 0) {
            console.log(`\n📊 Progression: ${processed}/${toProcess.length}`);
        }
        
        // Pause pour éviter de surcharger
        await new Promise(r => setTimeout(r, 300));
    }
    
    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ FINAL');
    console.log('='.repeat(60));
    console.log(`📦 Produits traités:     ${stats.productsProcessed}`);
    console.log(`⏭️  Produits ignorés:     ${stats.productsSkipped}`);
    console.log(`📸 Images uploadées:     ${stats.imagesUploaded}`);
    console.log(`🗑️  Images supprimées:    ${stats.imagesDeleted}`);
    console.log(`❌ Erreurs:              ${stats.errors}`);
    console.log('='.repeat(60));
}

main().catch(console.error);




