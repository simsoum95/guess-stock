/**
 * Upload images from "sam edelman vilber photo final" folder to Supabase Storage
 * and update image_index table
 * 
 * Usage: node scripts/upload-sam-vile-images.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOCAL_IMAGES_PATH = "C:\\Users\\1\\Desktop\\sam edelman vilber photo final";
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
 * Supports multiple formats:
 * - MODELREF-COLOR-*.jpg (e.g., "HBSE-325-0017-BLACK.jpg")
 * - MODELREF_COLOR_*.jpg (e.g., "HBSE_325_0017_BLACK.jpg")
 * - MODELREF COLOR.*.jpg (e.g., "HBSE 325 0017 BLACK.jpg")
 * - MODELREFCOLOR.*.jpg (e.g., "ACKC4A00MACARON.jpg")
 */
function parseImageFilename(fileName) {
    const baseName = fileName.replace(/\.[^/.]+$/, "").trim(); // Remove extension
    
    // Remove common prefixes if any
    let cleanName = baseName;
    
    // Try to extract modelRef and color from various patterns
    // IMPORTANT: Check underscore pattern FIRST for SAM EDELMAN (HBSE-125-0011_BLACK_1.jpg)
    
    // Pattern 1: MODELREF_COLOR (e.g., "HBSE-125-0011_BLACK_1" or "HBSE_325_0017_BLACK")
    // This is the most common pattern for SAM EDELMAN files
    if (cleanName.includes("_")) {
        const parts = cleanName.split("_");
        if (parts.length >= 2) {
            // First part is modelRef (e.g., "HBSE-125-0011")
            let modelRef = parts[0].trim().toUpperCase();
            // Second part is color (e.g., "BLACK")
            let color = parts[1].trim().toUpperCase();
            
            // Remove numeric suffixes if there are more parts (e.g., "BLACK_1" -> "BLACK")
            // But since we're only taking parts[1], the numeric suffix is in parts[2], so we don't need to remove it
            // The color is already correct in parts[1]
            
            if (modelRef && color && modelRef.length > 0 && color.length > 0) {
                return { modelRef, color };
            }
        }
    }
    
    // Pattern 2: MODELREF-COLOR (e.g., "HBSE-325-0017-BLACK" or "HBSE-325-0017-SOLID-BLACK")
    if (cleanName.includes("-")) {
        const parts = cleanName.split("-");
        if (parts.length >= 2) {
            // First part is usually modelRef (may contain numbers and letters)
            const modelRef = parts[0].trim().toUpperCase();
            // Last part(s) are usually color (may be multiple words)
            const color = parts.slice(1).join("-").trim().toUpperCase();
            if (modelRef && color && modelRef.length > 0 && color.length > 0) {
                return { modelRef, color };
            }
        }
    }
    
    // Pattern 3: MODELREF COLOR (space-separated)
    if (cleanName.includes(" ")) {
        const parts = cleanName.split(/\s+/);
        if (parts.length >= 2) {
            const modelRef = parts[0].trim().toUpperCase();
            const color = parts.slice(1).join(" ").trim().toUpperCase();
            if (modelRef && color && modelRef.length > 0 && color.length > 0) {
                return { modelRef, color };
            }
        }
    }
    
    // Pattern 4: Try to find a color code pattern (common color names/abbreviations)
    // Look for known color patterns at the end
    const colorPatterns = [
        /(BLACK|WHITE|RED|BLUE|GREEN|BROWN|BEIGE|TAN|NAVY|GREY|GRAY|PINK|YELLOW|ORANGE|PURPLE|BURGUNDY|BORDEAUX|IVORY|CREAM|TAN|KHAKI|CAMEL|SILVER|GOLD|ROSE|CORAL|TURQUOISE|AQUA|MINT|OLIVE|FOREST|MAROON|BERRY|WINE|PLUM|LILAC|LAVENDER|PEACH|APRICOT|COFFEE|CHOCOLATE|CARAMEL|HONEY|ALMOND|PECAN|TAUPE|DAWN|PARISIAN|SPICED|SOLID|MACARON)$/i,
        /(-[A-Z]{2,})$/, // Color code like -BL, -RD, etc.
    ];
    
    for (const pattern of colorPatterns) {
        const match = cleanName.match(pattern);
        if (match) {
            const color = match[1].replace(/^-/, "").trim().toUpperCase();
            const modelRef = cleanName.substring(0, match.index).replace(/[-_\s]+$/, "").trim().toUpperCase();
            if (modelRef && color && modelRef.length > 2 && color.length > 1) {
                return { modelRef, color };
            }
        }
    }
    
    // Last resort: try to split at last number/letter boundary
    // This is a fallback for unusual formats
    const lastNumberMatch = cleanName.match(/(.*?)([A-Z]{2,})$/);
    if (lastNumberMatch) {
        const modelRef = lastNumberMatch[1].replace(/[-_\s]+$/, "").trim().toUpperCase();
        const color = lastNumberMatch[2].trim().toUpperCase();
        if (modelRef && color && modelRef.length > 2 && color.length > 1) {
            return { modelRef, color };
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
        const ext = path.extname(fileName).substring(1).toLowerCase();
        const contentTypeMap = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
        };
        const contentType = contentTypeMap[ext] || 'image/jpeg';

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
                contentType: contentType,
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
    console.log("📦 Upload des images SAM EDELMAN et VILEBREQUIN");
    console.log("📦 Source:", LOCAL_IMAGES_PATH);
    console.log("📦 Destination: Supabase Storage →", SUPABASE_BUCKET_NAME, "/", SUPABASE_FOLDER);
    console.log("");

    // Read directory
    let files;
    try {
        files = await fs.readdir(LOCAL_IMAGES_PATH);
    } catch (error) {
        console.error(`❌ Erreur: Impossible de lire le dossier ${LOCAL_IMAGES_PATH}`);
        console.error("   Vérifiez le chemin et les permissions.");
        console.error("   Erreur:", error.message);
        process.exit(1);
    }

    // Filter image files
    const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext);
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
    let parseErrorCount = 0;
    const parseErrors = [];

    // Process each image
    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const filePath = path.join(LOCAL_IMAGES_PATH, file);
        
        process.stdout.write(`[${i + 1}/${imageFiles.length}] ${file}... `);

        // Parse filename
        const parsed = parseImageFilename(file);
        if (!parsed) {
            console.log("❌ Erreur: Impossible de parser le nom de fichier");
            parseErrorCount++;
            parseErrors.push(file);
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
            
            // Still try to update index if needed
            if (uploadResult.url) {
                const indexResult = await updateImageIndex(
                    parsed.modelRef,
                    parsed.color,
                    file,
                    uploadResult.url
                );
                if (indexResult.success && indexResult.action === 'inserted') {
                    indexedCount++;
                }
            }
        } else {
            uploadedCount++;
            console.log(`✅ Uploadé (${parsed.modelRef} - ${parsed.color})`);

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
    console.log(`❌ Erreurs parsing:      ${parseErrorCount}`);
    console.log(`❌ Erreurs upload:       ${errorCount}`);
    console.log(`⚠️  Erreurs index:       ${indexErrorCount}`);
    console.log("=".repeat(60));
    
    if (parseErrors.length > 0 && parseErrors.length <= 20) {
        console.log("\n⚠️  Fichiers non parsés (premiers 20):");
        parseErrors.slice(0, 20).forEach(file => console.log(`   - ${file}`));
        if (parseErrors.length > 20) {
            console.log(`   ... et ${parseErrors.length - 20} autres`);
        }
    }
    
    console.log("\n✅ Terminé ! Les nouvelles images sont maintenant disponibles dans le catalogue.");
    console.log("   Les produits correspondants seront automatiquement mis à jour lors du prochain chargement.");
}

main().catch(console.error);

