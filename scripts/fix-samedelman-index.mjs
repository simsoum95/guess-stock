import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Parse SamEdelman filename format
 * Example: "SamEdelman-RUE MED SHOULDER BAG-HBSE-325-0037A-26-BLACK-2pa.jpg"
 * → modelRef: "HBSE-325-0037A", color: "BLACK"
 */
function parseSamEdelmanFullFilename(filename) {
  const baseName = filename.replace(/\.[^/.]+$/, '');
  
  // Pattern: SamEdelman-{NAME}-HBSE-XXX-XXXX{A}-{colorCode}-{colorName}-{view}
  // Example: SamEdelman-RUE MED SHOULDER BAG-HBSE-325-0037A-26-BLACK-2pa
  const match = baseName.match(/SamEdelman-.*-(HBSE-\d{3}-\d{4}[A-Z]?)-(\d+)-([A-Z][A-Z\s]+)-/i);
  if (match) {
    return {
      modelRef: match[1].toUpperCase(),
      color: match[3].toUpperCase().trim() // Use color name (BLACK, SPICED PECAN) not code (26, 39)
    };
  }
  
  // Alternative pattern without color code number
  const match2 = baseName.match(/SamEdelman-.*-(HBSE-\d{3}-\d{4}[A-Z]?)-([A-Z][A-Z\s]+)-/i);
  if (match2) {
    return {
      modelRef: match2[1].toUpperCase(),
      color: match2[2].toUpperCase().trim()
    };
  }
  
  return null;
}

async function fixSamEdelmanIndex() {
  console.log("🔧 Fixing SamEdelman image index...\n");
  
  let offset = 0;
  const pageSize = 500;
  let hasMore = true;
  let totalFixed = 0;
  let totalSkipped = 0;
  let totalChecked = 0;
  
  while (hasMore) {
    const { data: images, error } = await supabase
      .from('image_index')
      .select('id, model_ref, color, filename, url')
      .eq('model_ref', 'SAMEDELMAN')
      .range(offset, offset + pageSize - 1)
      .order('id', { ascending: true });
    
    if (error) {
      console.error(`❌ Error fetching images:`, error.message);
      break;
    }
    
    if (!images || images.length === 0) {
      hasMore = false;
      break;
    }
    
    totalChecked += images.length;
    
    for (const img of images) {
      const parsed = parseSamEdelmanFullFilename(img.filename);
      
      if (parsed && parsed.modelRef && parsed.color) {
        const { error: updateError } = await supabase
          .from('image_index')
          .update({ 
            model_ref: parsed.modelRef, 
            color: parsed.color 
          })
          .eq('id', img.id);
        
        if (updateError) {
          console.error(`❌ Error updating ${img.filename}:`, updateError.message);
        } else {
          totalFixed++;
          if (totalFixed <= 20) {
            console.log(`✅ Fixed: ${img.filename}`);
            console.log(`   → modelRef: "${parsed.modelRef}", color: "${parsed.color}"`);
          }
        }
      } else {
        totalSkipped++;
        if (totalSkipped <= 5) {
          console.log(`⏭️  Skipped: ${img.filename}`);
        }
      }
    }
    
    if (images.length < pageSize) {
      hasMore = false;
    } else {
      offset += pageSize;
    }
    
    console.log(`   Progress: ${totalChecked} checked, ${totalFixed} fixed...`);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 RÉSUMÉ");
  console.log("=".repeat(60));
  console.log(`📝 Images vérifiées:  ${totalChecked}`);
  console.log(`✅ Images corrigées:  ${totalFixed}`);
  console.log(`⏭️  Images ignorées:   ${totalSkipped}`);
  console.log("=".repeat(60));
}

fixSamEdelmanIndex().catch(console.error);

