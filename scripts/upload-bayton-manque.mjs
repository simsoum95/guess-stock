#!/usr/bin/env node
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase variables manquantes');
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const SOURCE_DIR = 'C:\\Users\\1\\Desktop\\bayton manque';
const BUCKET_NAME = 'guess-images';

// Parse filename to extract modelRef and color
function parseFilename(fileName) {
    const baseName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
    
    // Format: BA-XXXXX_COLOR_N or BA-XXXXX-color-N
    const parts = baseName.split(/[_-]/);
    
    if (parts.length >= 3) {
        // BA-XXXXX = parts[0] + parts[1]
        const modelRef = `${parts[0]}-${parts[1]}`.toUpperCase();
        const color = parts[2].toUpperCase();
        return { modelRef, color };
    }
    
    return null;
}

async function uploadImages() {
    console.log('════════════════════════════════════════════════════════════');
    console.log('  UPLOAD BAYTON MANQUE');
    console.log('════════════════════════════════════════════════════════════\n');
    console.log(`Source: ${SOURCE_DIR}\n`);

    let files;
    try {
        files = await fs.readdir(SOURCE_DIR);
        files = files.filter(file => /\.(jpg|jpeg|png|webp|avif)$/i.test(file));
        console.log(`📁 Fichiers trouvés: ${files.length}\n`);
    } catch (error) {
        console.error(`❌ Erreur de lecture du dossier: ${error.message}`);
        return;
    }

    let uploadedCount = 0;
    let indexedCount = 0;
    let errorCount = 0;

    for (const file of files) {
        const parsed = parseFilename(file);
        if (!parsed) {
            console.log(`⚠️ Format non reconnu: ${file}`);
            continue;
        }

        const { modelRef, color } = parsed;
        const filePath = path.join(SOURCE_DIR, file);
        const storagePath = `products/${file}`;

        try {
            // Read file
            const fileBuffer = await fs.readFile(filePath);
            
            // Determine content type
            const ext = path.extname(file).toLowerCase();
            const contentTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp',
                '.avif': 'image/avif'
            };
            const contentType = contentTypes[ext] || 'image/jpeg';

            // Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(storagePath, fileBuffer, {
                    contentType,
                    upsert: true
                });

            if (uploadError) {
                console.error(`❌ Erreur upload ${file}:`, uploadError.message);
                errorCount++;
                continue;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(storagePath);

            const publicUrl = urlData?.publicUrl;

            // Index in database
            const { error: indexError } = await supabase
                .from('image_index')
                .upsert({
                    model_ref: modelRef,
                    color: color,
                    filename: file,
                    url: publicUrl
                }, {
                    onConflict: 'filename'
                });

            if (indexError) {
                console.error(`⚠️ Erreur index ${file}:`, indexError.message);
            } else {
                indexedCount++;
            }

            uploadedCount++;
            console.log(`✅ ${file} → ${modelRef} | ${color}`);

        } catch (error) {
            console.error(`❌ Erreur ${file}:`, error.message);
            errorCount++;
        }
    }

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`📁 Fichiers traités:  ${files.length}`);
    console.log(`✅ Uploadés:          ${uploadedCount}`);
    console.log(`📝 Indexés:           ${indexedCount}`);
    console.log(`❌ Erreurs:           ${errorCount}`);
    console.log('════════════════════════════════════════════════════════════\n');
}

uploadImages().catch(console.error);
