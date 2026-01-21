#!/usr/bin/env node
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchSheet(name) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(name)}?key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.values || data.values.length < 2) return [];
  const headers = data.values[0];
  return data.values.slice(1).map(row => {
    const obj = { _sheet: name };
    headers.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  });
}

async function main() {
  // Get products from all sheets
  const sheets = ['תיקים', 'נעליים', 'נעליים SAM'];
  let products = [];
  for (const s of sheets) {
    const p = await fetchSheet(s);
    products.push(...p);
  }

  // Get all image modelRefs
  let images = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase.from('image_index').select('model_ref').range(offset, offset + 999);
    if (!data || data.length === 0) break;
    images.push(...data);
    offset += 1000;
  }
  const imgSet = new Set(images.map(i => i.model_ref.toUpperCase()));

  // Find missing products
  const missing = [];
  for (const p of products) {
    const code = (p['קוד פריט'] || '').toUpperCase().trim();
    const modelRef = code.split('-')[0];
    if (modelRef && modelRef.length > 2 && !imgSet.has(modelRef)) {
      missing.push({
        code: p['קוד פריט'],
        modelRef,
        color: p['צבע'] || '',
        name: p['תיאור דגם'] || '',
        sheet: p._sheet
      });
    }
  }

  // Group by modelRef
  const byModel = new Map();
  missing.forEach(m => {
    if (!byModel.has(m.modelRef)) {
      byModel.set(m.modelRef, { modelRef: m.modelRef, name: m.name, colors: [], sheet: m.sheet });
    }
    if (!byModel.get(m.modelRef).colors.includes(m.color)) {
      byModel.get(m.modelRef).colors.push(m.color);
    }
  });

  // Print results
  console.log('═'.repeat(80));
  console.log('   LISTE COMPLETE DES PRODUITS SANS IMAGES');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`ModelRefs uniques sans images: ${byModel.size}`);
  console.log(`Total variantes (avec couleurs): ${missing.length}`);
  console.log('');
  
  // Group by sheet
  const bySheet = { 'תיקים': [], 'נעליים': [], 'נעליים SAM': [] };
  Array.from(byModel.values()).forEach(m => {
    if (bySheet[m.sheet]) bySheet[m.sheet].push(m);
  });

  for (const [sheet, items] of Object.entries(bySheet)) {
    if (items.length === 0) continue;
    console.log('');
    console.log(`═══ ${sheet} (${items.length} produits) ═══`);
    console.log('');
    items.forEach((m, i) => {
      console.log(`${String(i+1).padStart(3)}. ${m.modelRef.padEnd(15)} | ${m.name.substring(0,30).padEnd(30)} | ${m.colors.join(', ')}`);
    });
  }

  console.log('');
  console.log('═'.repeat(80));
}

main().catch(console.error);

