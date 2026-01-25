import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '18-jbOyUgsPAeHkn4ZQ2cioIENugZcYoGRwl_uhw';
const API_KEY = process.env.GOOGLE_API_KEY;

async function checkHeaders() {
    const sheets = ['תיקים', 'נעליים', 'BAYTON'];
    
    for (const sheet of sheets) {
        console.log(`\n=== SHEET: ${sheet} ===`);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheet)}!A1:K1?key=${API_KEY}`;
        
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.values && data.values[0]) {
                data.values[0].forEach((h, i) => {
                    console.log(`  Col ${String.fromCharCode(65 + i)}: ${h}`);
                });
            } else {
                console.log('  Erreur:', data.error?.message || 'No data');
            }
        } catch (err) {
            console.log('  Erreur:', err.message);
        }
    }
}

checkHeaders().catch(console.error);

