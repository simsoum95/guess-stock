#!/usr/bin/env node
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const API_KEY = process.env.GOOGLE_API_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchSheet(name) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(name)}?key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.values) return [];
  const headers = data.values[0];
  return data.values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  });
}

async function main() {
  console.log('═'.repeat(60));
  console.log('   RECOMPTAGE COMPLET - CHAQUE LIGNE = 1 PRODUIT');
  console.log('═'.repeat(60));
  console.log('');

  // Get all image modelRefs from Supabase
  let imgs = [];
  let off = 0;
  while (true) {
    const { data } = await supabase.from('image_index').select('model_ref').range(off, off + 999);
    if (!data || !data.length) break;
    imgs.push(...data);
    off += 1000;
  }
  const imgSet = new Set(imgs.map(i => i.model_ref.toUpperCase()));
  console.log(`Images dans Supabase: ${imgSet.size} modelRefs uniques`);
  console.log('');

  // Count products from each sheet
  const sheets = ['תיקים', 'נעליים', 'נעליים SAM', 'VILEBREQUIN'];
  let grandTotal = 0;
  let totalWith = 0;
  let totalWithout = 0;

  console.log('Feuille                  | Total | Avec img | Sans img');
  console.log('-'.repeat(60));

  for (const sheetName of sheets) {
    const prods = await fetchSheet(sheetName);
    let withImg = 0;
    let withoutImg = 0;

    for (const p of prods) {
      const itemCode = (p['קוד פריט'] || '').toUpperCase().trim();
      const modelRef = itemCode.split('-')[0];
      
      if (!modelRef || modelRef.length < 2) continue;

      if (imgSet.has(modelRef)) {
        withImg++;
      } else {
        withoutImg++;
      }
    }

    const total = withImg + withoutImg;
    grandTotal += total;
    totalWith += withImg;
    totalWithout += withoutImg;

    console.log(`${sheetName.padEnd(24)} | ${String(total).padStart(5)} | ${String(withImg).padStart(8)} | ${String(withoutImg).padStart(8)}`);
  }

  console.log('-'.repeat(60));
  console.log(`${'TOTAL'.padEnd(24)} | ${String(grandTotal).padStart(5)} | ${String(totalWith).padStart(8)} | ${String(totalWithout).padStart(8)}`);
  console.log('');
  console.log('═'.repeat(60));
  console.log(`   ✅ Produits AVEC images:  ${totalWith}`);
  console.log(`   ❌ Produits SANS images:  ${totalWithout}`);
  console.log('═'.repeat(60));
}

main().catch(console.error);

