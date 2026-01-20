#!/usr/bin/env node
/**
 * Script de diagnostic pour comprendre pourquoi les images VILEBREQUIN
 * ne s'affichent pas correctement.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getGoogleSheetColors() {
    console.log('📊 Récupération des produits VILEBREQUIN depuis Google Sheets...\n');
    
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
        console.log('⚠️ Pas de GOOGLE_API_KEY, utilisation du CSV export...\n');
        
        // Utiliser le CSV export public
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        
        // Parser le CSV
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        
        const modelRefIdx = headers.findIndex(h => h.includes('קוד גם') || h === 'modelRef');
        const colorIdx = headers.findIndex(h => h === 'צבע' || h === 'color');
        const brandIdx = headers.findIndex(h => h.includes('מותג') || h === 'brand');
        
        console.log('Colonnes trouvées:', { modelRefIdx, colorIdx, brandIdx });
        
        const vileProducts = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
            const brand = values[brandIdx] || '';
            if (brand.toUpperCase() === 'VILEBREQUIN') {
                vileProducts.push({
                    modelRef: values[modelRefIdx],
                    color: values[colorIdx],
                    brand: brand
                });
            }
        }
        
        return vileProducts;
    }
    
    // Utiliser l'API Google Sheets
    const sheets = google.sheets({ version: 'v4', auth: apiKey });
    const { data } = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: process.env.GOOGLE_SHEET_NAME || 'Sheet1'
    });
    
    const rows = data.values || [];
    const headers = rows[0] || [];
    
    const modelRefIdx = headers.findIndex(h => h.includes('קוד גם') || h === 'modelRef');
    const colorIdx = headers.findIndex(h => h === 'צבע' || h === 'color');
    const brandIdx = headers.findIndex(h => h.includes('מותג') || h === 'brand');
    
    const vileProducts = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const brand = row[brandIdx] || '';
        if (brand.toUpperCase() === 'VILEBREQUIN') {
            vileProducts.push({
                modelRef: row[modelRefIdx],
                color: row[colorIdx],
                brand: brand
            });
        }
    }
    
    return vileProducts;
}

async function getImageIndexColors() {
    console.log('📷 Récupération des couleurs depuis image_index...\n');
    
    const { data, error } = await supabase
        .from('image_index')
        .select('model_ref, color')
        .or('model_ref.like.CR%,model_ref.like.PL%,model_ref.like.PY%,model_ref.like.FL%,model_ref.like.MO%,model_ref.like.JI%,model_ref.like.AC%,model_ref.like.BM%');
    
    if (error) {
        console.error('Erreur:', error);
        return [];
    }
    
    // Grouper par modelRef
    const grouped = {};
    for (const row of data) {
        if (!grouped[row.model_ref]) {
            grouped[row.model_ref] = new Set();
        }
        grouped[row.model_ref].add(row.color);
    }
    
    return grouped;
}

async function diagnose() {
    try {
        // Récupérer les produits depuis Google Sheets
        const sheetProducts = await getGoogleSheetColors();
        console.log(`✅ ${sheetProducts.length} produits VILEBREQUIN dans Google Sheets\n`);
        
        // Récupérer les couleurs depuis image_index
        const indexColors = await getImageIndexColors();
        console.log(`✅ ${Object.keys(indexColors).length} produits VILEBREQUIN dans image_index\n`);
        
        // Comparer et trouver les problèmes
        console.log('=' .repeat(80));
        console.log('ANALYSE DES COULEURS - GOOGLE SHEETS vs IMAGE_INDEX');
        console.log('=' .repeat(80) + '\n');
        
        // Grouper les produits Sheet par modelRef
        const sheetByModel = {};
        for (const p of sheetProducts) {
            if (!sheetByModel[p.modelRef]) {
                sheetByModel[p.modelRef] = new Set();
            }
            sheetByModel[p.modelRef].add(p.color);
        }
        
        let matchedProducts = 0;
        let unmatchedProducts = 0;
        const missingColors = [];
        
        for (const [modelRef, sheetColors] of Object.entries(sheetByModel)) {
            const indexColorsSet = indexColors[modelRef];
            
            console.log(`\n📦 ${modelRef}`);
            console.log(`   Google Sheets: ${[...sheetColors].join(', ')}`);
            
            if (!indexColorsSet) {
                console.log(`   ❌ PAS D'IMAGES DANS INDEX!`);
                unmatchedProducts++;
                for (const color of sheetColors) {
                    missingColors.push({ modelRef, color, reason: 'No images in index' });
                }
                continue;
            }
            
            console.log(`   Image Index:   ${[...indexColorsSet].join(', ')}`);
            
            // Vérifier chaque couleur du Sheet
            for (const sheetColor of sheetColors) {
                const sheetColorUpper = sheetColor.toUpperCase().trim();
                const sheetColorNorm = sheetColorUpper.replace(/[^A-Z0-9]/g, '');
                
                let found = false;
                for (const indexColor of indexColorsSet) {
                    const indexColorUpper = indexColor.toUpperCase().trim();
                    const indexColorNorm = indexColorUpper.replace(/[^A-Z0-9]/g, '');
                    
                    if (sheetColorUpper === indexColorUpper || 
                        sheetColorNorm === indexColorNorm ||
                        sheetColor === indexColor) {
                        found = true;
                        break;
                    }
                }
                
                if (found) {
                    console.log(`   ✅ "${sheetColor}" → Match trouvé`);
                    matchedProducts++;
                } else {
                    console.log(`   ❌ "${sheetColor}" → PAS DE MATCH!`);
                    unmatchedProducts++;
                    missingColors.push({ 
                        modelRef, 
                        color: sheetColor, 
                        availableColors: [...indexColorsSet].join(', '),
                        reason: 'Color mismatch' 
                    });
                }
            }
        }
        
        console.log('\n' + '=' .repeat(80));
        console.log('RÉSUMÉ');
        console.log('=' .repeat(80));
        console.log(`\n✅ Produits avec images matchées: ${matchedProducts}`);
        console.log(`❌ Produits sans images matchées: ${unmatchedProducts}`);
        
        if (missingColors.length > 0) {
            console.log(`\n⚠️ COULEURS À CORRIGER (${missingColors.length}):`);
            for (const m of missingColors) {
                console.log(`   - ${m.modelRef} / "${m.color}"`);
                if (m.availableColors) {
                    console.log(`     Couleurs disponibles dans index: ${m.availableColors}`);
                }
            }
        }
        
    } catch (error) {
        console.error('Erreur:', error);
    }
}

diagnose();




