#!/usr/bin/env node
/**
 * Script pour tester le matching exact des produits SAM EDELMAN
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
    console.log('🔍 Test de matching SAM EDELMAN');
    console.log('='.repeat(60));
    
    // 1. Récupérer toutes les images de image_index
    console.log('\n📸 Récupération des images...');
    const { data: allImages, error } = await supabase
        .from('image_index')
        .select('*');
    
    if (error) {
        console.error('❌ Erreur:', error.message);
        return;
    }
    
    console.log(`   Total images dans DB: ${allImages.length}`);
    
    // Build imageMap and modelRefIndex exactly like fetchProducts.ts
    const imageMap = new Map();
    const modelRefIndex = new Map();
    
    for (const img of allImages) {
        const modelRef = img.model_ref.toUpperCase().trim();
        const color = (img.color || '').toUpperCase().trim();
        const key = `${modelRef}|${color}`;
        
        if (!imageMap.has(key)) {
            imageMap.set(key, { imageUrl: img.url, gallery: [img.url] });
        } else {
            imageMap.get(key).gallery.push(img.url);
        }
        
        if (!modelRefIndex.has(modelRef)) {
            modelRefIndex.set(modelRef, []);
        }
        const existing = modelRefIndex.get(modelRef).find(x => x.color === color);
        if (!existing) {
            modelRefIndex.get(modelRef).push({
                color: color,
                images: { imageUrl: img.url, gallery: [img.url] }
            });
        } else {
            existing.images.gallery.push(img.url);
        }
    }
    
    console.log(`   ModelRef index size: ${modelRefIndex.size}`);
    
    // 2. Lister les modelRef SAM EDELMAN dans l'index
    console.log('\n📋 ModelRef SAM EDELMAN dans image_index:');
    const samModelRefs = [];
    for (const [modelRef, items] of modelRefIndex.entries()) {
        if (modelRef.startsWith('HBSE-')) {
            samModelRefs.push(modelRef);
            console.log(`   ${modelRef}: ${items.length} couleur(s) - ${items.map(i => i.color).join(', ')}`);
        }
    }
    
    // 3. Simuler le matching pour un produit SAM EDELMAN
    console.log('\n🧪 Simulation du matching:');
    
    // Simuler un produit SAM EDELMAN
    const testProducts = [
        { modelRef: 'HBSE-325-0007', color: 'BLACK', brand: 'SAM EDELMAN' },
        { modelRef: 'HBSE-325-0017', color: 'BLACK', brand: 'SAM EDELMAN' },
        { modelRef: 'HBSE-325-0037', color: 'BLACK', brand: 'SAM EDELMAN' },
    ];
    
    for (const product of testProducts) {
        console.log(`\n   Test: ${product.modelRef} (brand: ${product.brand})`);
        
        const modelRefImages = modelRefIndex.get(product.modelRef);
        console.log(`   - modelRefImages trouvé? ${modelRefImages ? 'OUI (' + modelRefImages.length + ' items)' : 'NON'}`);
        
        if (modelRefImages) {
            const allUrls = [];
            for (const item of modelRefImages) {
                console.log(`     - Color: ${item.color}, URL: ${item.images.imageUrl}`);
                allUrls.push(...item.images.gallery);
            }
            console.log(`   - Total URLs: ${allUrls.length}`);
        }
        
        // Test condition
        const isSamEdelman = product.brand === 'SAM EDELMAN';
        console.log(`   - brand === "SAM EDELMAN"? ${isSamEdelman}`);
        console.log(`   - Condition complète: ${isSamEdelman && modelRefImages && modelRefImages.length > 0}`);
    }
    
    // 4. Vérifier ce que retourne le Google Sheet
    console.log('\n📊 Vérification du Google Sheet:');
    const sheetName = 'נעליים SAM';
    const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    
    const response = await fetch(url);
    const text = await response.text();
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
    const data = JSON.parse(jsonMatch[1]);
    const rows = data.table?.rows || [];
    const cols = data.table?.cols || [];
    
    console.log(`   Colonnes: ${cols.map(c => c.label).join(', ')}`);
    console.log(`   Lignes: ${rows.length}`);
    
    // Afficher les premiers produits
    console.log('\n   Premiers produits:');
    for (let i = 0; i < Math.min(5, rows.length); i++) {
        const cells = rows[i].c || [];
        const itemCode = cells[6]?.v; // Colonne G
        const color = cells[7]?.v; // Colonne H
        
        if (itemCode) {
            const parts = itemCode.split('-');
            const modelRef = parts.length >= 3 ? `${parts[0]}-${parts[1]}-${parts[2]}` : parts[0];
            const hasImage = modelRefIndex.has(modelRef.toUpperCase());
            console.log(`   ${i+1}. itemCode: ${itemCode}, modelRef: ${modelRef}, color: ${color} -> ${hasImage ? '✅ IMAGE' : '❌ NO IMAGE'}`);
        }
    }
}

main().catch(console.error);

