import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '18-jbOyUgsPAeHkn4ZQ2cioIENugZcYoGRwl_uhw';
const API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyCRwji2FYXkEHh34NzWNvkM7_e2VB68wF0';

async function checkBayton() {
    console.log('=== VERIFICATION DONNEES BAYTON ===\n');
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/BAYTON!A:K?key=${API_KEY}`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data.values) {
        console.log('Erreur:', data);
        return;
    }
    
    const headers = data.values[0];
    console.log('En-têtes:');
    headers.forEach((h, i) => console.log(`  Col ${String.fromCharCode(65 + i)} (${i}): ${h}`));
    console.log('');
    
    // List all subcategories
    console.log('=== SUBCATEGORIES BAYTON ===\n');
    const subcats = new Map();
    data.values.slice(1).forEach((row) => {
        const subcat = row[1] || '(vide)';
        subcats.set(subcat, (subcats.get(subcat) || 0) + 1);
    });
    subcats.forEach((count, subcat) => console.log(`  - ${subcat}: ${count} produits`));
    
    // Find ACHILLE products
    console.log('\n=== PRODUITS ACHILLE ===\n');
    
    let achilleCount = 0;
    data.values.slice(1).forEach((row, i) => {
        const colB = row[1] || '';  // תת משפחה / subcategory
        const colD = row[3] || '';  // תיאור דגם / model description
        const colG = row[6] || '';  // קוד גם / model code
        const colH = row[7] || '';  // צבע / color
        
        if (colD.toUpperCase().includes('ACHILLE')) {
            achilleCount++;
            console.log(`Ligne ${i + 2}:`);
            console.log(`  Col B (subcategory): ${colB}`);
            console.log(`  Col D (description): ${colD}`);
            console.log(`  Col G (code):        ${colG || '<<< VIDE!'}`);
            console.log(`  Col H (couleur):     ${colH}`);
            console.log('');
        }
    });
    
    console.log(`Total produits ACHILLE: ${achilleCount}`);
}

checkBayton().catch(console.error);

