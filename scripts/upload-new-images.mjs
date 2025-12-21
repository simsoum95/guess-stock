/**
 * Upload new images from local folder to Supabase Storage
 * and update image_index table
 * 
 * Usage: node scripts/upload-new-images.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOCAL_IMAGES_PATH = "C:\\Users\\1\\Desktop\\nouvelle image check";
const SUPABASE_BUCKET_NAME = "guess-images";
const SUPABASE_FOLDER = "products";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

/**
 * Parse image filename to extract modelRef and color
 * Supports formats like: MODELREF-COLOR-*.jpg, MODELREF_COLOR_*.jpg
 */
function parseImageFilename(fileName) {
    const baseName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
    
    // Try dash format first: MODELREF-COLOR-...
    if (baseName.includes("-")) {
        const parts = baseName.split("-");
        if (parts.length >= 2) {
            return {
                modelRef: parts[0].trim().toUpperCase(),
                color: parts[1].trim().toUpperCase(),
            };
        }
    }
    
    // Try underscore format: MODELREF_COLOR_...
    if (baseName.includes("_")) {
        const parts = baseName.split("_");
        if (parts.length >= 2) {
            return {
                modelRef: parts[0].trim().toUpperCase(),
                color: parts[1].trim().toUpperCase(),
            };
        }
    }

    return null;
}

/**
 * Upload image to Supabase Storage
 */
async function uploadImage(filePath, fileName) {
    const supabasePath = `${SUPABASE_FOLDER}/${fileName}`;

    try {
        const fileContent = await fs.readFile(filePath);

        // Check if file already exists
        const { data: existingFiles, error: listError } = await supabase.storage
            .from(SUPABASE_BUCKET_NAME)
            .list(SUPABASE_FOLDER, { 
                search: fileName,
                limit: 1
            });

        if (listError && listError.message !== 'The resource was not found') {
            console.warn(`⚠️  Warning checking ${fileName}: ${listError.message}`);
        }

        const fileExists = existingFiles && existingFiles.some(f => f.name === fileName);

        if (fileExists) {
            return { success: true, skipped: true, message: "already exists" };
        }

        // Upload file
        const { data, error } = await supabase.storage
            .from(SUPABASE_BUCKET_NAME)
            .upload(supabasePath, fileContent, {
                contentType: `image/${path.extname(fileName).substring(1).toLowerCase()}`,
                upsert: false,
            });

        if (error) {
            throw error;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(SUPABASE_BUCKET_NAME)
            .getPublicUrl(supabasePath);

        return { success: true, url: urlData?.publicUrl, skipped: false };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Insert or update image in image_index table
 */
async function updateImageIndex(modelRef, color, fileName, url) {
    try {
        // Check if image already exists in index
        const { data: existing, error: checkError } = await supabase
            .from('image_index')
            .select('id')
            .eq('filename', fileName)
            .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw checkError;
        }

        if (existing) {
            // Update existing entry
            const { error: updateError } = await supabase
                .from('image_index')
                .update({
                    model_ref: modelRef,
                    color: color,
                    url: url,
                })
                .eq('filename', fileName);

            if (updateError) throw updateError;
            return { success: true, action: 'updated' };
        } else {
            // Insert new entry
            const { error: insertError } = await supabase
                .from('image_index')
                .insert({
                    model_ref: modelRef,
                    color: color,
                    filename: fileName,
                    url: url,
                });

            if (insertError) throw insertError;
            return { success: true, action: 'inserted' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Main function
 */
async function main() {
    console.log("📦 Upload des nouvelles images depuis:", LOCAL_IMAGES_PATH);
    console.log("📦 Destination: Supabase Storage →", SUPABASE_BUCKET_NAME, "/", SUPABASE_FOLDER);
    console.log("");

    // Read directory
    let files;
    try {
        files = await fs.readdir(LOCAL_IMAGES_PATH);
    } catch (error) {
        console.error(`❌ Erreur: Impossible de lire le dossier ${LOCAL_IMAGES_PATH}`);
        console.error("   Vérifiez le chemin et les permissions.");
        process.exit(1);
    }

    // Filter image files
    const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });

    if (imageFiles.length === 0) {
        console.log("⚠️  Aucune image trouvée dans le dossier.");
        return;
    }

    console.log(`✅ ${imageFiles.length} images trouvées\n`);

    let uploadedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let indexedCount = 0;
    let indexErrorCount = 0;

    // Process each image
    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const filePath = path.join(LOCAL_IMAGES_PATH, file);
        
        process.stdout.write(`[${i + 1}/${imageFiles.length}] ${file}... `);

        // Parse filename
        const parsed = parseImageFilename(file);
        if (!parsed) {
            console.log("❌ Erreur: Impossible de parser le nom de fichier (format: MODELREF-COLOR-...)");
            errorCount++;
            continue;
        }

        // Upload to Storage
        const uploadResult = await uploadImage(filePath, file);
        if (!uploadResult.success) {
            console.log(`❌ Erreur upload: ${uploadResult.error}`);
            errorCount++;
            continue;
        }

        if (uploadResult.skipped) {
            skippedCount++;
            console.log(`⏭️  Ignoré (déjà existant)`);
        } else {
            uploadedCount++;
            console.log(`✅ Uploadé`);

            // Update image_index
            if (uploadResult.url) {
                const indexResult = await updateImageIndex(
                    parsed.modelRef,
                    parsed.color,
                    file,
                    uploadResult.url
                );

                if (indexResult.success) {
                    indexedCount++;
                    process.stdout.write(` → Index ${indexResult.action}\n`);
                } else {
                    indexErrorCount++;
                    console.log(` ⚠️  Erreur index: ${indexResult.error}`);
                }
            }
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 RÉSUMÉ");
    console.log("=".repeat(60));
    console.log(`📤 Images uploadées:    ${uploadedCount}`);
    console.log(`⏭️  Images ignorées:     ${skippedCount} (déjà existantes)`);
    console.log(`📝 Images indexées:      ${indexedCount}`);
    console.log(`❌ Erreurs upload:       ${errorCount}`);
    console.log(`⚠️  Erreurs index:       ${indexErrorCount}`);
    console.log("=".repeat(60));
    console.log("\n✅ Terminé ! Les nouvelles images sont maintenant disponibles dans le catalogue.");
    console.log("   Les produits correspondants seront automatiquement mis à jour lors du prochain chargement.");
}

main().catch(console.error);

