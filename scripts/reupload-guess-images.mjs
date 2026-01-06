#!/usr/bin/env node
/**
 * Script pour ré-uploader les images GUESS manquantes
 * Lit le dossier local et uploade celles qui ne sont pas dans Supabase
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables Supabase manquantes');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SOURCE_FOLDER = 'C:\\Users\\1\\Desktop\\new image guess';
const BUCKET_NAME = 'guess-images';

// Stats
const stats = {
    totalFiles: 0,
    alreadyExists: 0,
    uploaded: 0,
    errors: 0,
    skipped: 0
};

/**
 * Récupère tous les filenames existants dans image_index
 */
async function getExistingFilenames() {
    console.log('📋 Récupération des images existantes...');
    
    const existingFilenames = new Set();
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
        const { data, error } = await supabase
            .from('image_index')
            .select('filename')
            .range(offset, offset + pageSize - 1);
        
        if (error) {
            console.error('❌ Erreur:', error.message);
            break;
        }
        
        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            data.forEach(row => existingFilenames.add(row.filename.toUpperCase()));
            offset += pageSize;
        }
    }
    
    console.log(`   ✅ ${existingFilenames.size} images déjà dans la base`);
    return existingFilenames;
}

/**
 * Liste tous les fichiers images dans un dossier (récursif)
 */
function getAllImageFiles(dir) {
    const files = [];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    
    function walkDir(currentDir) {
        try {
            const items = fs.readdirSync(currentDir);
            for (const item of items) {
                const fullPath = path.join(currentDir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    walkDir(fullPath);
                } else if (stat.isFile()) {
                    const ext = path.extname(item).toLowerCase();
                    if (validExtensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (err) {
            console.warn(`⚠️ Erreur lecture dossier ${currentDir}:`, err.message);
        }
    }
    
    walkDir(dir);
    return files;
}

/**
 * Parse le nom de fichier pour extraire modelRef et color
 */
function parseFilename(filename) {
    // Nettoyer le nom de fichier
    const baseName = path.basename(filename, path.extname(filename))
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .toUpperCase();
    
    // Patterns communs pour GUESS:
    // PD760221_BLO_DITA_B.jpg -> modelRef: PD760221, color: BLO
    // CV866522-OFF-SIDE.jpg -> modelRef: CV866522, color: OFF
    // BG877630_COG_1.jpg -> modelRef: BG877630, color: COG
    
    let modelRef = '';
    let color = '';
    
    // Pattern avec underscore: MODELREF_COLOR_...
    if (baseName.includes('_')) {
        const parts = baseName.split('_');
        modelRef = parts[0];
        color = parts[1] || 'DEFAULT';
        // Nettoyer la couleur des suffixes numériques
        color = color.replace(/\d+$/, '').trim() || color;
    }
    // Pattern avec tiret: MODELREF-COLOR-...
    else if (baseName.includes('-')) {
        const parts = baseName.split('-');
        modelRef = parts[0];
        color = parts[1] || 'DEFAULT';
        color = color.replace(/\d+$/, '').trim() || color;
    }
    // Pas de séparateur: tout est modelRef
    else {
        modelRef = baseName;
        color = 'DEFAULT';
    }
    
    // Nettoyer modelRef
    modelRef = modelRef.replace(/[^A-Z0-9]/g, '');
    
    return { modelRef, color };
}

/**
 * Uploade une image sur Supabase
 */
async function uploadImage(filePath, existingFilenames) {
    const originalFilename = path.basename(filePath);
    const normalizedFilename = originalFilename.toUpperCase();
    
    // Vérifier si déjà existant
    if (existingFilenames.has(normalizedFilename)) {
        stats.alreadyExists++;
        return { success: false, reason: 'exists' };
    }
    
    try {
        // Lire le fichier
        const buffer = fs.readFileSync(filePath);
        
        // Parser le nom de fichier
        const { modelRef, color } = parseFilename(originalFilename);
        
        if (!modelRef) {
            stats.skipped++;
            return { success: false, reason: 'invalid_filename' };
        }
        
        const ext = path.extname(originalFilename).toLowerCase();
        const storagePath = normalizedFilename;
        
        // Uploader sur Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, buffer, {
                contentType: `image/${ext.slice(1) === 'jpg' ? 'jpeg' : ext.slice(1)}`,
                upsert: true
            });
        
        if (uploadError) {
            throw new Error(uploadError.message);
        }
        
        // Obtenir l'URL publique
        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath);
        
        // Indexer dans image_index
        const { error: indexError } = await supabase
            .from('image_index')
            .upsert({
                model_ref: modelRef,
                color: color,
                filename: normalizedFilename,
                url: publicUrl,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'filename'
            });
        
        if (indexError) {
            console.warn(`   ⚠️ Indexation échouée pour ${normalizedFilename}:`, indexError.message);
        }
        
        // Ajouter au set des existants pour éviter les doublons
        existingFilenames.add(normalizedFilename);
        
        stats.uploaded++;
        return { success: true, filename: normalizedFilename, modelRef, color };
    } catch (error) {
        stats.errors++;
        return { success: false, reason: error.message };
    }
}

/**
 * Fonction principale
 */
async function main() {
    console.log('🚀 Ré-upload des images GUESS manquantes');
    console.log('='.repeat(60));
    console.log(`📁 Dossier source: ${SOURCE_FOLDER}`);
    console.log('='.repeat(60));
    
    // Vérifier que le dossier existe
    if (!fs.existsSync(SOURCE_FOLDER)) {
        console.error(`❌ Dossier non trouvé: ${SOURCE_FOLDER}`);
        process.exit(1);
    }
    
    // Récupérer les images existantes
    const existingFilenames = await getExistingFilenames();
    
    // Lister tous les fichiers images
    console.log('\n📂 Scan du dossier...');
    const imageFiles = getAllImageFiles(SOURCE_FOLDER);
    stats.totalFiles = imageFiles.length;
    console.log(`   📸 ${imageFiles.length} fichiers images trouvés`);
    
    // Filtrer les images déjà existantes
    const filesToUpload = imageFiles.filter(f => {
        const filename = path.basename(f).toUpperCase();
        return !existingFilenames.has(filename);
    });
    
    console.log(`   📤 ${filesToUpload.length} images à uploader`);
    console.log('='.repeat(60));
    
    // Uploader les images manquantes
    let processed = 0;
    for (const filePath of filesToUpload) {
        processed++;
        
        const result = await uploadImage(filePath, existingFilenames);
        
        if (result.success) {
            if (stats.uploaded <= 20 || stats.uploaded % 100 === 0) {
                console.log(`✅ [${processed}/${filesToUpload.length}] ${result.filename} -> ${result.modelRef}/${result.color}`);
            }
        } else if (result.reason !== 'exists') {
            console.log(`❌ [${processed}/${filesToUpload.length}] ${path.basename(filePath)}: ${result.reason}`);
        }
        
        // Progression
        if (processed % 200 === 0) {
            console.log(`\n📈 Progression: ${processed}/${filesToUpload.length} (${Math.round(processed/filesToUpload.length*100)}%)`);
            console.log(`   ✅ Uploadés: ${stats.uploaded} | ❌ Erreurs: ${stats.errors}\n`);
        }
        
        // Petite pause pour éviter le rate limiting
        if (processed % 50 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    // Résumé final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ FINAL');
    console.log('='.repeat(60));
    console.log(`📁 Fichiers scannés:      ${stats.totalFiles}`);
    console.log(`✅ Images uploadées:      ${stats.uploaded}`);
    console.log(`⏭️  Déjà existantes:       ${stats.alreadyExists}`);
    console.log(`⚠️  Ignorées:             ${stats.skipped}`);
    console.log(`❌ Erreurs:               ${stats.errors}`);
    console.log('='.repeat(60));
    console.log('\n✅ Terminé!');
}

main().catch(console.error);

