#!/usr/bin/env node
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function main() {
    console.log('📋 Analyse du Google Sheet SAM EDELMAN');
    console.log('='.repeat(60));
    
    const sheetName = 'נעליים SAM';
    const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    
    const response = await fetch(url);
    const text = await response.text();
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
    const data = JSON.parse(jsonMatch[1]);
    const rows = data.table?.rows || [];
    const cols = data.table?.cols || [];
    
    console.log(`\n📊 Colonnes:`);
    cols.forEach((col, i) => console.log(`   ${i}: ${col.label}`));
    
    console.log(`\n📝 Lignes: ${rows.length}`);
    
    // Analyser les itemCode
    const prefixes = {};
    const formats = { hbse: [], other: [] };
    
    console.log(`\n📋 Tous les produits:`);
    for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].c || [];
        const itemCode = cells[6]?.v?.toString() || ''; // Colonne G
        const color = cells[7]?.v?.toString() || ''; // Colonne H
        const description = cells[3]?.v?.toString() || ''; // Colonne D
        const subcategory = cells[1]?.v?.toString() || ''; // Colonne B
        const stock = cells[10]?.v || 0; // Colonne K
        
        if (!itemCode) continue;
        
        const prefix = itemCode.slice(0, 4);
        prefixes[prefix] = (prefixes[prefix] || 0) + 1;
        
        // Extraire modelRef
        let modelRef;
        const parts = itemCode.split('-');
        if (parts.length >= 3) {
            modelRef = `${parts[0]}-${parts[1]}-${parts[2]}`;
            formats.hbse.push({ itemCode, modelRef, color, stock });
        } else {
            modelRef = parts[0];
            formats.other.push({ itemCode, modelRef, color, stock });
        }
        
        console.log(`   ${i+1}. ${itemCode} -> modelRef: ${modelRef}, color: ${color}, stock: ${stock}`);
    }
    
    console.log(`\n📊 Préfixes trouvés:`);
    Object.entries(prefixes).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => {
        console.log(`   ${p}: ${c}`);
    });
    
    console.log(`\n📊 Formats:`);
    console.log(`   Format HBSE-XXX-XXX: ${formats.hbse.length}`);
    console.log(`   Autre format: ${formats.other.length}`);
}

main().catch(console.error);

