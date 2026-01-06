import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from project root
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Parse SAM EDELMAN filename
 * Examples:
 * - "HBSE-225-0107-26-front.jpg" → modelRef: "HBSE-225-0107", color: "26"
 * - "HBSE-125-0118 -26-back.jpg" → modelRef: "HBSE-125-0118", color: "26"
 * - "HBSE-125-0014A_EGGSHELL_1.jpg" → modelRef: "HBSE-125-0014A", color: "EGGSHELL"
 * - "HBSE-225-0107-26 A.jpg" → modelRef: "HBSE-225-0107", color: "26"
 * - "HBSE-325-0029-26-1.jpg" → modelRef: "HBSE-325-0029", color: "26"
 * - "HBSE-325-0012-26 lifestyle.jpg" → modelRef: "HBSE-325-0012", color: "26"
 */
function parseSamEdelmanFilename(filename) {
  const baseName = filename.replace(/\.[^/.]+$/, ''); // Remove extension
  
  // Pattern 1: HBSE-XXX-XXXX_COLOR_N.jpg (underscore separated)
  const underscoreMatch = baseName.match(/^(HBSE-\d{3}-\d{4}[A-Z]?)_([A-Z]+)(?:_\d+)?$/i);
  if (underscoreMatch) {
    return {
      modelRef: underscoreMatch[1].toUpperCase(),
      color: underscoreMatch[2].toUpperCase()
    };
  }
  
  // Pattern 2: HBSE-XXX-XXXX-ColorCode-view.jpg or with extra suffixes
  // e.g., HBSE-325-0029-26-1.jpg, HBSE-325-0029-26-CU.jpg
  const dashMatch = baseName.match(/^(HBSE-\d{3}-\d{4}[A-Z]?)\s*-\s*(\d{1,2}|[A-Z]+)(?:\s*[-\s].*)?$/i);
  if (dashMatch) {
    return {
      modelRef: dashMatch[1].toUpperCase().replace(/\s/g, ''),
      color: dashMatch[2].toUpperCase()
    };
  }
  
  // Pattern 3: Just HBSE-XXX-XXXX-ColorCode.jpg
  const simpleMatch = baseName.match(/^(HBSE-\d{3}-\d{4}[A-Z]?)-(\d{1,2}|[A-Z]+)$/i);
  if (simpleMatch) {
    return {
      modelRef: simpleMatch[1].toUpperCase(),
      color: simpleMatch[2].toUpperCase()
    };
  }
  
  return null;
}

/**
 * Parse VILEBREQUIN filename
 * Examples:
 * - "PYRE9O00-315-back.jpg" → modelRef: "PYRE9000", color: "315"
 * - "VBQ - SUMMER 25 - STILL LIFE - 10.jpg" → Skip (lifestyle image, no product match)
 */
function parseVilebrequinFilename(filename) {
  const baseName = filename.replace(/\.[^/.]+$/, '');
  
  // Pattern: PYRE9000-XXX-view.jpg or PYRE9O00-XXX-view.jpg (O instead of 0)
  const pyreMatch = baseName.match(/^(PYRE\d[O0]\d{2})-(\d{3})(?:-(?:front|back|side|detail))?$/i);
  if (pyreMatch) {
    // Fix O to 0 in model ref
    const modelRef = pyreMatch[1].toUpperCase().replace(/O/g, '0');
    return {
      modelRef: modelRef,
      color: pyreMatch[2]
    };
  }
  
  // VBQ lifestyle images - skip these as they don't match products
  if (baseName.startsWith('VBQ -') || baseName.startsWith('VBQ-')) {
    return null; // Skip lifestyle images
  }
  
  return null;
}

async function fixImageIndex() {
  console.log("🔧 Fixing SAM EDELMAN and VILEBREQUIN image index...\n");
  
  let offset = 0;
  const pageSize = 500;
  let hasMore = true;
  let totalFixed = 0;
  let totalSkipped = 0;
  let totalChecked = 0;
  
  while (hasMore) {
    // Fetch images that need fixing (model_ref = 'HBSE' or 'VBQ')
    const { data: images, error } = await supabase
      .from('image_index')
      .select('id, model_ref, color, filename, url')
      .or('model_ref.eq.HBSE,model_ref.eq.VBQ')
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
      let parsed = null;
      
      if (img.model_ref === 'HBSE') {
        parsed = parseSamEdelmanFilename(img.filename);
      } else if (img.model_ref === 'VBQ') {
        parsed = parseVilebrequinFilename(img.filename);
      }
      
      if (parsed && parsed.modelRef && parsed.color) {
        // Update the image index with correct values
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
          if (totalFixed <= 30) {
            console.log(`✅ Fixed: ${img.filename}`);
            console.log(`   Old: model_ref="${img.model_ref}", color="${img.color}"`);
            console.log(`   New: model_ref="${parsed.modelRef}", color="${parsed.color}"`);
          }
        }
      } else {
        totalSkipped++;
        if (totalSkipped <= 10) {
          console.log(`⏭️  Skipped (no match): ${img.filename}`);
        }
      }
    }
    
    if (images.length < pageSize) {
      hasMore = false;
    } else {
      offset += pageSize;
    }
    
    console.log(`   Progress: ${totalChecked} checked, ${totalFixed} fixed, ${totalSkipped} skipped...`);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 RÉSUMÉ");
  console.log("=".repeat(60));
  console.log(`📝 Images vérifiées:  ${totalChecked}`);
  console.log(`✅ Images corrigées:  ${totalFixed}`);
  console.log(`⏭️  Images ignorées:   ${totalSkipped}`);
  console.log("=".repeat(60));
}

fixImageIndex().catch(console.error);

