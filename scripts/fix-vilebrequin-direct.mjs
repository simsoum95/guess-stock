#!/usr/bin/env node
/**
 * Script de correction directe des images VILEBREQUIN
 * 
 * Ce script télécharge les images directement depuis GlobalOnline
 * en construisant les URLs basées sur les codes de couleur connus.
 * 
 * Pattern GlobalOnline:
 * https://www.globalonline.co.il/media/catalog/product/P/L/PLTH2N00_390_1_2.jpg
 *                                                           ^^^code couleur
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';

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
// MAPPING CODES COULEUR
// =============================================================================
const COLOR_CODE_TO_NAME = {
    '010': 'BLANC',
    '390': 'BLEU MARINE',
    '990': 'NOIR',
    '399': 'NOIR',
    '315': 'BLEU',
    '300': 'BLEU CIEL',
};

// Configuration des produits à corriger avec leurs couleurs
const PRODUCTS_TO_FIX = [
    {
        modelRef: 'PLTH2N00',
        colors: [
            { code: '010', name: 'BLANC', imageCount: 4 },
            { code: '390', name: 'BLEU MARINE', imageCount: 4 },
        ]
    },
    {
        modelRef: 'PYRE9O00',
        colors: [
            { code: '010', name: 'BLANC', imageCount: 4 },
            { code: '390', name: 'BLEU MARINE', imageCount: 4 },
        ]
    },
];

const stats = {
    imagesUploaded: 0,
    imagesDeleted: 0,
    errors: 0,
};

/**
 * Construit l'URL d'une image GlobalOnline
 */
function buildGlobalOnlineUrl(modelRef, colorCode, imageIndex) {
    const code = modelRef.toUpperCase();
    const firstLetter = code[0];
    const secondLetter = code[1];
    
    // Pattern avec cache (plus stable)
    return `https://www.globalonline.co.il/media/catalog/product/cache/4445b38ba39c4c595346ee41e84dd066/${firstLetter}/${secondLetter}/${code}_${colorCode}_${imageIndex}_2.jpg`;
}

/**
 * Supprime les images existantes pour un modelRef
 */
async function deleteExistingImages(modelRef) {
    const { data: existing, error } = await supabase
        .from('image_index')
        .select('id, filename')
        .eq('model_ref', modelRef.toUpperCase());
    
    if (error || !existing || existing.length === 0) return 0;
    
    const filenames = existing.map(e => e.filename);
    await supabase.storage.from('guess-images').remove(filenames);
    
    const ids = existing.map(e => e.id);
    await supabase.from('image_index').delete().in('id', ids);
    
    return existing.length;
}

/**
 * Télécharge et uploade une image
 */
async function downloadAndUpload(imageUrl, modelRef, colorName, index) {
    try {
        console.log(`      📥 Téléchargement: ${imageUrl.split('/').pop()}`);
        
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
        
        // Vérifier que c'est bien une image
        if (buffer.length < 1000) {
            return { success: false, error: 'Image trop petite (probablement erreur)' };
        }
        
        // Créer le nom de fichier
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
 * Traite un produit
 */
async function processProduct(product) {
    const { modelRef, colors } = product;
    
    console.log(`\n🔍 Traitement de ${modelRef}`);
    
    // Supprimer les anciennes images
    const deleted = await deleteExistingImages(modelRef);
    if (deleted > 0) {
        console.log(`   🗑️ ${deleted} anciennes images supprimées`);
        stats.imagesDeleted += deleted;
    }
    
    // Pour chaque couleur
    for (const colorInfo of colors) {
        const { code, name, imageCount } = colorInfo;
        console.log(`\n   🎨 ${name} (code ${code})`);
        
        // Télécharger chaque image
        for (let i = 1; i <= imageCount; i++) {
            const url = buildGlobalOnlineUrl(modelRef, code, i);
            const result = await downloadAndUpload(url, modelRef, name, i);
            
            if (result.success) {
                console.log(`      ✅ ${result.filename}`);
                stats.imagesUploaded++;
            } else {
                console.log(`      ❌ Image ${i}: ${result.error}`);
                stats.errors++;
            }
            
            await new Promise(r => setTimeout(r, 200));
        }
    }
}

/**
 * Programme principal
 */
async function main() {
    console.log('🚀 Correction DIRECTE des images VILEBREQUIN');
    console.log('='.repeat(60));
    console.log('📋 Mapping des codes couleur:');
    console.log('   010 = BLANC');
    console.log('   390 = BLEU MARINE');
    console.log('='.repeat(60));
    
    // Traiter chaque produit
    for (const product of PRODUCTS_TO_FIX) {
        await processProduct(product);
    }
    
    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`📸 Images uploadées:    ${stats.imagesUploaded}`);
    console.log(`🗑️  Images supprimées:   ${stats.imagesDeleted}`);
    console.log(`❌ Erreurs:             ${stats.errors}`);
    console.log('='.repeat(60));
}

main().catch(console.error);




