#!/usr/bin/env node
/**
 * Script COMPLET pour corriger TOUTES les images VILEBREQUIN et SAM EDELMAN
 * 
 * Ce script:
 * 1. Récupère tous les produits avec des problèmes de couleur
 * 2. Scrape GlobalOnline pour chaque produit
 * 3. Télécharge et uploade les images avec les bonnes couleurs
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables Supabase manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Mapping des codes couleur GlobalOnline vers noms lisibles
const COLOR_CODE_MAP = {
  '010': 'BLANC',
  '390': 'BLEU MARINE',
  '990': 'NOIR',
  '031': 'BLEU CIEL',
  '360': 'BLEU',
  '374': 'MARINE',
  '320': 'TURQUOISE',
  '100': 'JAUNE',
  '200': 'ORANGE',
  '250': 'ROUGE',
  '280': 'ROSE',
  '050': 'GRIS',
  '055': 'GRIS FONCE',
  '120': 'VERT',
  '140': 'VERT FONCE',
};

/**
 * Récupère le HTML d'une page GlobalOnline
 */
async function fetchHTML(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    return null;
  }
}

/**
 * Extrait les variantes de couleur et leurs images depuis GlobalOnline
 */
async function scrapeProductColors(modelRef) {
  const url = `https://www.globalonline.co.il/${modelRef.toLowerCase()}`;
  const html = await fetchHTML(url);
  
  if (!html) {
    console.log(`  ⚠️  Page non trouvée pour ${modelRef}`);
    return null;
  }

  const $ = cheerio.load(html);
  const colorVariants = {};
  
  // Chercher les options de couleur dans le HTML
  const colorOptions = $('[data-option-label]').filter((_, el) => {
    const label = $(el).attr('data-option-label');
    return label && (label.includes('BLANC') || label.includes('BLEU') || label.includes('NOIR') || 
                     label.includes('MARINE') || label.includes('WHITE') || label.includes('BLACK'));
  });

  // Extraire les images depuis les scripts JSON
  const scripts = $('script[type="text/x-magento-init"]').toArray();
  
  for (const script of scripts) {
    const content = $(script).html();
    if (!content) continue;
    
    try {
      // Chercher les URLs d'images dans le contenu
      const imageMatches = content.match(/https:\/\/www\.globalonline\.co\.il\/media\/catalog\/product[^"']+\.jpg/gi);
      
      if (imageMatches) {
        for (const imgUrl of imageMatches) {
          // Extraire le code couleur du nom de fichier
          // Format: PLTH2N00_390_1_2.jpg ou PLTH2N00_010_1.jpg
          const match = imgUrl.match(new RegExp(`${modelRef}_?(\\d{3})_`, 'i'));
          
          if (match) {
            const colorCode = match[1];
            const colorName = COLOR_CODE_MAP[colorCode] || colorCode;
            
            if (!colorVariants[colorName]) {
              colorVariants[colorName] = [];
            }
            
            if (!colorVariants[colorName].includes(imgUrl)) {
              colorVariants[colorName].push(imgUrl);
            }
          }
        }
      }
    } catch (e) {
      // Ignorer les erreurs de parsing
    }
  }

  // Si aucune variante trouvée via scripts, chercher directement dans les images
  if (Object.keys(colorVariants).length === 0) {
    const allImages = $('img[src*="globalonline.co.il/media/catalog/product"]').toArray();
    
    for (const img of allImages) {
      const src = $(img).attr('src');
      if (!src) continue;
      
      const match = src.match(new RegExp(`${modelRef}_?(\\d{3})_`, 'i'));
      if (match) {
        const colorCode = match[1];
        const colorName = COLOR_CODE_MAP[colorCode] || colorCode;
        
        if (!colorVariants[colorName]) {
          colorVariants[colorName] = [];
        }
        
        if (!colorVariants[colorName].includes(src)) {
          colorVariants[colorName].push(src);
        }
      }
    }
  }

  // Si toujours rien, essayer de construire les URLs directement
  if (Object.keys(colorVariants).length === 0) {
    // Tester les codes couleur courants
    for (const [code, name] of Object.entries(COLOR_CODE_MAP)) {
      const testUrls = [];
      for (let i = 1; i <= 4; i++) {
        testUrls.push(`https://www.globalonline.co.il/media/catalog/product/${modelRef.charAt(0)}/${modelRef.charAt(1)}/${modelRef}_${code}_${i}_2.jpg`);
        testUrls.push(`https://www.globalonline.co.il/media/catalog/product/${modelRef.charAt(0)}/${modelRef.charAt(1)}/${modelRef}_${code}_${i}.jpg`);
      }
      
      // Tester la première URL
      const testUrl = testUrls[0];
      try {
        const testResponse = await fetch(testUrl, { method: 'HEAD' });
        if (testResponse.ok) {
          colorVariants[name] = testUrls;
        }
      } catch (e) {
        // URL n'existe pas
      }
    }
  }

  return colorVariants;
}

/**
 * Télécharge une image et l'uploade sur Supabase
 */
async function downloadAndUploadImage(imageUrl, modelRef, color, index) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    
    const buffer = await response.arrayBuffer();
    const colorSafe = color.replace(/\s+/g, '_').toUpperCase();
    const filename = `${modelRef}_${colorSafe}_${index}.JPG`;
    
    // Upload sur Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('guess-images')
      .upload(filename, buffer, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    if (uploadError && !uploadError.message.includes('already exists')) {
      console.log(`    ⚠️  Erreur upload ${filename}: ${uploadError.message}`);
      return null;
    }
    
    // Obtenir l'URL publique
    const { data: urlData } = supabase.storage
      .from('guess-images')
      .getPublicUrl(filename);
    
    return {
      filename,
      url: urlData.publicUrl
    };
  } catch (error) {
    console.log(`    ⚠️  Erreur téléchargement: ${error.message}`);
    return null;
  }
}

/**
 * Met à jour l'index des images dans la base de données
 */
async function updateImageIndex(modelRef, color, filename, url) {
  // Vérifier si l'entrée existe déjà
  const { data: existing } = await supabase
    .from('image_index')
    .select('id')
    .eq('model_ref', modelRef)
    .eq('filename', filename)
    .single();
  
  if (existing) {
    // Mettre à jour
    await supabase
      .from('image_index')
      .update({ color, url })
      .eq('id', existing.id);
  } else {
    // Insérer
    await supabase
      .from('image_index')
      .insert({
        model_ref: modelRef,
        color,
        filename,
        url
      });
  }
}

/**
 * Corrige un produit spécifique
 */
async function fixProduct(modelRef) {
  console.log(`\n📦 Traitement de ${modelRef}...`);
  
  // Scraper GlobalOnline
  const colorVariants = await scrapeProductColors(modelRef);
  
  if (!colorVariants || Object.keys(colorVariants).length === 0) {
    console.log(`  ℹ️  Aucune variante de couleur trouvée sur GlobalOnline`);
    return { fixed: false, reason: 'no_colors_found' };
  }
  
  console.log(`  ✓ Trouvé ${Object.keys(colorVariants).length} couleur(s): ${Object.keys(colorVariants).join(', ')}`);
  
  // Supprimer les anciennes images incorrectes
  const { data: oldImages } = await supabase
    .from('image_index')
    .select('id, filename')
    .eq('model_ref', modelRef);
  
  if (oldImages && oldImages.length > 0) {
    // Supprimer de image_index
    await supabase
      .from('image_index')
      .delete()
      .eq('model_ref', modelRef);
    
    console.log(`  🗑️  Supprimé ${oldImages.length} anciennes entrées`);
  }
  
  // Télécharger et uploader les nouvelles images
  let totalUploaded = 0;
  
  for (const [color, imageUrls] of Object.entries(colorVariants)) {
    console.log(`  📷 Téléchargement des images ${color}...`);
    
    for (let i = 0; i < Math.min(imageUrls.length, 6); i++) {
      const result = await downloadAndUploadImage(imageUrls[i], modelRef, color, i + 1);
      
      if (result) {
        await updateImageIndex(modelRef, color, result.filename, result.url);
        totalUploaded++;
      }
      
      // Petit délai pour éviter le rate limiting
      await new Promise(r => setTimeout(r, 200));
    }
  }
  
  console.log(`  ✅ ${totalUploaded} images uploadées pour ${modelRef}`);
  return { fixed: true, images: totalUploaded };
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Correction COMPLÈTE des images VILEBREQUIN et SAM EDELMAN\n');
  console.log('='.repeat(60));
  
  // Récupérer tous les produits avec des problèmes
  const { data: problematicProducts, error } = await supabase
    .from('image_index')
    .select('model_ref, color')
    .or(`color.eq.DEFAULT,color.eq.model_ref,color.like.%U05%,color.eq.HBSE,color.eq.325`)
    .order('model_ref');
  
  // Aussi récupérer les produits VILEBREQUIN où color = model_ref
  const { data: vilebrequinProds } = await supabase
    .from('image_index')
    .select('model_ref, color')
    .or('model_ref.like.PL%,model_ref.like.PY%,model_ref.like.CR%,model_ref.like.JI%,model_ref.like.MO%,model_ref.like.HBSE%')
    .order('model_ref');
  
  // Filtrer les produits où la couleur est égale au model_ref ou est un code numérique
  const allProducts = new Set();
  
  if (vilebrequinProds) {
    for (const p of vilebrequinProds) {
      // Si la couleur est égale au model_ref ou est un code numérique
      if (p.color === p.model_ref || 
          p.color === 'DEFAULT' || 
          p.color === 'HBSE' ||
          /^\d+$/.test(p.color) ||
          p.color.includes('U05')) {
        allProducts.add(p.model_ref);
      }
    }
  }
  
  const modelRefs = [...allProducts];
  console.log(`\n📋 ${modelRefs.length} produits à vérifier/corriger\n`);
  
  // Limiter à 10 produits pour le premier test
  const testLimit = process.argv.includes('--all') ? modelRefs.length : 10;
  const toProcess = modelRefs.slice(0, testLimit);
  
  if (!process.argv.includes('--all')) {
    console.log(`⚠️  Mode test: traitement de ${testLimit} produits seulement`);
    console.log(`   Utilisez --all pour traiter tous les ${modelRefs.length} produits\n`);
  }
  
  let fixed = 0;
  let failed = 0;
  
  for (const modelRef of toProcess) {
    const result = await fixProduct(modelRef);
    if (result.fixed) {
      fixed++;
    } else {
      failed++;
    }
    
    // Délai entre les produits
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Terminé!`);
  console.log(`   - Produits corrigés: ${fixed}`);
  console.log(`   - Produits non trouvés: ${failed}`);
  
  if (!process.argv.includes('--all') && modelRefs.length > testLimit) {
    console.log(`\n📝 Pour corriger TOUS les ${modelRefs.length} produits, exécutez:`);
    console.log(`   node scripts/fix-all-brands-complete.mjs --all`);
  }
}

main().catch(console.error);

