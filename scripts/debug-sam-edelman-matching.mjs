#!/usr/bin/env node
/**
 * Script de debug pour vérifier le matching des produits SAM EDELMAN
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!supabaseUrl || !supabaseKey || !GOOGLE_SHEET_ID) {
    console.error('❌ Variables manquantes');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('🔍 Debug: Matching SAM EDELMAN');
    console.log('='.repeat(60));
    
    // 1. Récupérer les modelRef des produits dans image_index
    const { data: indexedImages } = await supabase
        .from('image_index')
        .select('model_ref')
        .or('model_ref.ilike.HBSE%,model_ref.ilike.FESE%,model_ref.ilike.SBSE%');
    
    const indexedModelRefs = new Set((indexedImages || []).map(img => img.model_ref.toUpperCase()));
    console.log(`\n📸 ModelRef dans image_index (${indexedModelRefs.size}):`);
    Array.from(indexedModelRefs).sort().forEach(mr => console.log(`   - ${mr}`));
    
    // 2. Récupérer les produits depuis Google Sheet
    const sheetName = 'נעליים SAM';
    const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    
    const response = await fetch(url);
    const text = await response.text();
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
    const data = JSON.parse(jsonMatch[1]);
    const rows = data.table?.rows || [];
    const cols = data.table?.cols || [];
    
    let itemCodeColIndex = 6; // Colonne G
    for (let i = 0; i < cols.length; i++) {
        const label = cols[i].label?.toLowerCase() || '';
        if (label.includes('קוד פריט') || label === 'itemcode') {
            itemCodeColIndex = i;
            break;
        }
    }
    
    const sheetModelRefs = new Set();
    const sampleProducts = [];
    
    for (const row of rows) {
        const cells = row.c || [];
        const itemCode = cells[itemCodeColIndex]?.v?.toString().trim();
        
        if (itemCode) {
            const parts = itemCode.split('-');
            if (parts.length >= 3) {
                const modelRef = `${parts[0]}-${parts[1]}-${parts[2]}`.toUpperCase();
                sheetModelRefs.add(modelRef);
                
                if (sampleProducts.length < 10) {
                    sampleProducts.push({ itemCode, modelRef });
                }
            }
        }
    }
    
    console.log(`\n📋 ModelRef dans Google Sheet (${sheetModelRefs.size}):`);
    Array.from(sheetModelRefs).sort().slice(0, 20).forEach(mr => console.log(`   - ${mr}`));
    if (sheetModelRefs.size > 20) {
        console.log(`   ... et ${sheetModelRefs.size - 20} autres`);
    }
    
    // 3. Comparer
    console.log(`\n🔍 COMPARAISON:`);
    console.log(`   ModelRef dans image_index: ${indexedModelRefs.size}`);
    console.log(`   ModelRef dans Google Sheet: ${sheetModelRefs.size}`);
    
    const matching = Array.from(sheetModelRefs).filter(mr => indexedModelRefs.has(mr));
    console.log(`   ✅ Correspondances: ${matching.length}`);
    if (matching.length > 0) {
        console.log(`   Correspondances: ${matching.join(', ')}`);
    }
    
    const missing = Array.from(sheetModelRefs).filter(mr => !indexedModelRefs.has(mr));
    console.log(`   ❌ Non trouvés dans image_index: ${missing.length}`);
    if (missing.length > 0 && missing.length <= 20) {
        console.log(`   Exemples: ${missing.slice(0, 10).join(', ')}`);
    }
    
    // 4. Exemples de produits
    console.log(`\n📝 Exemples de produits (premiers 10):`);
    sampleProducts.forEach(p => {
        const hasImage = indexedModelRefs.has(p.modelRef);
        console.log(`   ${hasImage ? '✅' : '❌'} ${p.modelRef} (itemCode: ${p.itemCode})`);
    });
}

main().catch(console.error);

