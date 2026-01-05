/**
 * Upload new images from local folder to Supabase Storage
 * and update image_index table
 * 
 * Usage: node scripts/upload-new-images-05-01-26.mjs
 * 
 * This script:
 * 1. Scans the folder for images
 * 2. Parses filenames to extract modelRef and color
 * 3. Checks for duplicates in Supabase Storage
 * 4. Uploads only new images
 * 5. Indexes them in image_index table
 */

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOCAL_IMAGES_PATH = "C:\\Users\\1\\Desktop\\guess image 05.01.26";
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
 * Examples: PD760221_LUG_DITA_B.jpg -> modelRef: PD760221, color: LUG
 */
function parseImageFilename(fileName) {
    const baseName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
    
    // Try underscore format first (most common): MODELREF_COLOR_...
    if (baseName.includes("_")) {
        const parts = baseName.split("_");
        if (parts.length >= 2) {
            return {
                modelRef: parts[0].trim().toUpperCase(),
                color: parts[1].trim().toUpperCase(),
            };
        }
    }
    
    // Try dash format: MODELREF-COLOR-...
    if (baseName.includes("-")) {
        const parts = baseName.split("-");
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

        // Check if file already exists in storage
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
            return { success: true, skipped: true, message: "already exists in storage" };
        }

        // Upload file
        const { data, error } = await supabase.storage
            .from(SUPABASE_BUCKET_NAME)
            .upload(supabasePath, fileContent, {
                contentType: `image/${path.extname(fileName).substring(1).toLowerCase()}`,
                upsert: false, // Don't overwrite if exists
            });

        if (error) {
            // If file already exists, skip it
            if (error.message.includes('already exists') || error.message.includes('duplicate')) {
                return { success: true, skipped: true, message: "already exists" };
            }
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
 * Check if image already exists in image_index by filename
 */
async function imageExistsInIndex(fileName) {
    try {
        const { data, error } = await supabase
            .from('image_index')
            .select('id')
            .eq('filename', fileName)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return !!data;
    } catch (error) {
        console.error(`Error checking index for ${fileName}:`, error.message);
        return false;
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

        if (checkError && checkError.code !== 'PGRST116') {
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
    console.log("=".repeat(60));

    // Check if folder exists
    try {
        await fs.access(LOCAL_IMAGES_PATH);
    } catch (error) {
        console.error(`❌ Error: Folder not found: ${LOCAL_IMAGES_PATH}`);
        process.exit(1);
    }

    // Get all image files
    const files = await fs.readdir(LOCAL_IMAGES_PATH);
    const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
    });

    console.log(`\n📁 ${imageFiles.length} images trouvées dans le dossier\n`);

    if (imageFiles.length === 0) {
        console.log("✅ Aucune image à traiter");
        return;
    }

    let uploaded = 0;
    let skipped = 0;
    let indexed = 0;
    let errors = 0;
    const errorsList = [];

    // Process each image
    for (let i = 0; i < imageFiles.length; i++) {
        const fileName = imageFiles[i];
        const filePath = path.join(LOCAL_IMAGES_PATH, fileName);

        process.stdout.write(`\r📤 Processing ${i + 1}/${imageFiles.length}: ${fileName}...`);

        // Parse filename
        const parsed = parseImageFilename(fileName);
        if (!parsed) {
            console.log(`\n⚠️  Skipped ${fileName}: Cannot parse filename (format: MODELREF_COLOR_... or MODELREF-COLOR-...)`);
            skipped++;
            continue;
        }

        const { modelRef, color } = parsed;

        // Check if already in index
        const existsInIndex = await imageExistsInIndex(fileName);
        if (existsInIndex) {
            console.log(`\n⏭️  Skipped ${fileName}: Already indexed`);
            skipped++;
            continue;
        }

        // Upload to storage
        const uploadResult = await uploadImage(filePath, fileName);
        
        if (!uploadResult.success) {
            console.log(`\n❌ Error uploading ${fileName}: ${uploadResult.error}`);
            errors++;
            errorsList.push({ fileName, error: uploadResult.error });
            continue;
        }

        if (uploadResult.skipped) {
            console.log(`\n⏭️  Skipped ${fileName}: ${uploadResult.message}`);
            skipped++;
            
            // Even if skipped in storage, check if we need to index it
            if (!existsInIndex && uploadResult.url) {
                const indexResult = await updateImageIndex(modelRef, color, fileName, uploadResult.url);
                if (indexResult.success) {
                    indexed++;
                }
            }
            continue;
        }

        uploaded++;

        // Index the image
        if (uploadResult.url) {
            const indexResult = await updateImageIndex(modelRef, color, fileName, uploadResult.url);
            if (indexResult.success) {
                indexed++;
            } else {
                console.log(`\n⚠️  Warning: Image uploaded but indexing failed for ${fileName}: ${indexResult.error}`);
            }
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("\n📊 Résumé:");
    console.log(`   ✅ Uploadées: ${uploaded}`);
    console.log(`   ⏭️  Ignorées (déjà existantes): ${skipped}`);
    console.log(`   📝 Indexées: ${indexed}`);
    console.log(`   ❌ Erreurs: ${errors}`);

    if (errorsList.length > 0) {
        console.log("\n❌ Erreurs détaillées:");
        errorsList.forEach(({ fileName, error }) => {
            console.log(`   - ${fileName}: ${error}`);
        });
    }

    console.log("\n✅ Terminé!");
}

main().catch(console.error);

