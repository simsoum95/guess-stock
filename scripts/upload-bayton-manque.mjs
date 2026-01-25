import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase variables manquantes');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SOURCE_DIR = 'C:\\Users\\1\\Desktop\\bayton manque';
const BUCKET_NAME = 'guess-images';
const STORAGE_FOLDER = 'products';

// Parse filename to extract modelRef and color
function parseFilename(filename) {
    const baseName = filename.replace(/\.[^/.]+$/, ''); // Remove extension
    
    // Format: BA-40220_NAVY_10_1 or BA-46608-black-1 or BA-46900_lila-1
    // Try underscore first
    let parts = baseName.split('_');
    if (parts.length >= 2) {
        const modelRef = parts[0].toUpperCase(); // BA-40220
        const color = parts[1].toUpperCase(); // NAVY
        return { modelRef, color };
    }
    
    // Try dash format (after first BA-XXXXX)
    const match = baseName.match(/^(BA-\d+)[-_]([a-zA-Z]+)/i);
    if (match) {
        return {
            modelRef: match[1].toUpperCase(),
            color: match[2].toUpperCase()
        };
    }
    
    return null;
}

async function uploadImages() {
    console.log('════════════════════════════════════════════════════════════');
    console.log('  UPLOAD BAYTON MANQUE');
    console.log('════════════════════════════════════════════════════════════\n');
    
    const files = fs.readdirSync(SOURCE_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    console.log(`📁 ${files.length} images trouvées\n`);
    
    let uploaded = 0;
    let errors = 0;
    
    for (const file of files) {
        const parsed = parseFilename(file);
        if (!parsed) {
            console.log(`⚠️ Ignoré (format non reconnu): ${file}`);
            errors++;
            continue;
        }
        
        const { modelRef, color } = parsed;
        const filePath = path.join(SOURCE_DIR, file);
        const storagePath = `${STORAGE_FOLDER}/${modelRef}-${color}-${file}`;
        
        console.log(`📤 ${file} → ${modelRef} | ${color}`);
        
        try {
            const fileBuffer = fs.readFileSync(filePath);
            const ext = file.split('.').pop().toLowerCase();
            const contentType = ext === 'webp' ? 'image/webp' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            
            // Upload to storage
            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(storagePath, fileBuffer, {
                    contentType,
                    upsert: true
                });
            
            if (uploadError) {
                console.log(`   ❌ Upload error: ${uploadError.message}`);
                errors++;
                continue;
            }
            
            // Get public URL
            const { data: urlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(storagePath);
            
            // Index in database
            const { error: indexError } = await supabase
                .from('image_index')
                .upsert({
                    model_ref: modelRef,
                    color: color,
                    filename: file,
                    url: urlData.publicUrl,
                    path: storagePath
                }, {
                    onConflict: 'filename'
                });
            
            if (indexError) {
                console.log(`   ⚠️ Index error: ${indexError.message}`);
            }
            
            uploaded++;
            console.log(`   ✅ OK`);
            
        } catch (err) {
            console.log(`   ❌ Error: ${err.message}`);
            errors++;
        }
    }
    
    console.log('\n════════════════════════════════════════════════════════════');
    console.log(`✅ Uploadés: ${uploaded}`);
    console.log(`❌ Erreurs: ${errors}`);
    console.log('════════════════════════════════════════════════════════════\n');
}

uploadImages().catch(console.error);

