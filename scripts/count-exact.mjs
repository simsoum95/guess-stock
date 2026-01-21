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
  console.log('COMPTAGE EXACT DES PRODUITS\n');
  
  // Charger TOUTES les feuilles
  const sheets = ['תיקים', 'נעליים', 'נעליים SAM', 'VILEBREQUIN'];
  let all = [];
  
  for (const s of sheets) {
    const p = await fetchSheet(s);
    console.log(`${s}: ${p.length} produits`);
    all.push(...p.map(x => ({...x, _sheet: s})));
  }
  console.log(`\nTOTAL PRODUITS GOOGLE SHEET: ${all.length}`);

  // Charger toutes les images de l'index
  let imgs = [];
  let off = 0;
  while (true) {
    const { data } = await supabase.from('image_index').select('model_ref').range(off, off + 999);
    if (!data || !data.length) break;
    imgs.push(...data);
    off += 1000;
  }
  const imgSet = new Set(imgs.map(i => i.model_ref.toUpperCase()));
  console.log(`ModelRefs uniques avec images dans Supabase: ${imgSet.size}`);

  // Compter CHAQUE LIGNE (chaque produit + couleur = 1 ligne)
  let withImg = 0;
  let noImg = 0;
  const noImgList = [];
  const bySheet = {};

  for (const p of all) {
    const code = (p['קוד פריט'] || '').toUpperCase().trim();
    const modelRef = code.split('-')[0];
    const sheet = p._sheet;
    
    if (!modelRef || modelRef.length < 2) continue;
    
    if (!bySheet[sheet]) bySheet[sheet] = { with: 0, without: 0 };

    if (imgSet.has(modelRef)) {
      withImg++;
      bySheet[sheet].with++;
    } else {
      noImg++;
      bySheet[sheet].without++;
      noImgList.push({
        modelRef,
        code,
        color: p['צבע'] || '',
        name: p['תיאור דגם'] || '',
        sheet
      });
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('RESULTAT EXACT');
  console.log('='.repeat(50));
  console.log(`\nProduits AVEC images dans Supabase: ${withImg}`);
  console.log(`Produits SANS images dans Supabase: ${noImg}`);
  console.log(`TOTAL analysé: ${withImg + noImg}`);
  
  console.log('\nDétail par feuille:');
  for (const [sheet, stats] of Object.entries(bySheet)) {
    const total = stats.with + stats.without;
    console.log(`  ${sheet}: ${stats.with} avec / ${stats.without} sans (total: ${total})`);
  }

  console.log('\n' + '='.repeat(50));
  console.log(`LISTE DES ${noImg} PRODUITS SANS IMAGES`);
  console.log('='.repeat(50));
  
  noImgList.forEach((p, i) => {
    console.log(`${String(i+1).padStart(3)}. ${p.code.padEnd(20)} | ${p.color.padEnd(20)} | ${p.name.substring(0,25)} [${p.sheet}]`);
  });
}

main().catch(console.error);

