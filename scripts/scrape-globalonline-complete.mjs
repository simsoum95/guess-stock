/**
 * Script complet pour télécharger TOUTES les images de globalonline.co.il
 * et les uploader vers Supabase Storage
 * 
 * Usage: node scripts/scrape-globalonline-complete.mjs
 */

import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Configuration
const BASE_URL = 'https://www.globalonline.co.il';
const DOWNLOAD_DIR = './scraped-images';
const DELAY_BETWEEN_PAGES = 2000; // 2 seconds between pages (be nice to the server)
const DELAY_BETWEEN_PRODUCTS = 500; // 0.5 seconds between products

// All category URLs to scrape
const CATEGORIES = [
  // Bags
  '/women/bags.html',
  '/women/bags/tik-tzad.html',
  '/women/bags/tik-gav.html',
  '/women/bags/tik-nesia.html',
  '/women/bags/pouches.html',
  '/women/bags/tik-erev.html',
  '/women/bags/arnakot.html',
  '/women/bags/tik-nesiot.html',
  '/women/bags/mizvadot.html',
  '/women/bags/tik-mini.html',
  
  // Shoes Women
  '/women/shoes.html',
  '/women/shoes/megafayim.html',
  '/women/shoes/sneakers.html',
  '/women/shoes/naalei-akev.html',
  '/women/shoes/naalayim-shtukhot.html',
  '/women/shoes/sandalim.html',
  '/women/shoes/kafkafim.html',
  
  // Shoes Men
  '/men/shoes.html',
  '/men/shoes/sneakers.html',
  '/men/shoes/megafayim.html',
  '/men/shoes/kafkafim.html',
  '/men/shoes/sandalim.html',
  
  // Men bags
  '/men/bags.html',
  
  // Brands - GUESS
  '/brands/guess.html',
  '/brands/guess/shoes.html',
  '/brands/guess/bags.html',
  
  // Brands - SAM EDELMAN
  '/brands/sam-edelman.html',
  '/brands/sam-edelman/bags.html',
  '/brands/sam-edelman/sneakers.html',
  '/brands/sam-edelman/naalei-akev.html',
  '/brands/sam-edelman/naalayim-shtukhot.html',
  '/brands/sam-edelman/sandalim.html',
  '/brands/sam-edelman/kafkafim.html',
  '/brands/sam-edelman/megafayim.html',
  
  // Brands - VILEBREQUIN
  '/brands/vilebrequin.html',
  '/brands/vilebrequin/men.html',
  '/brands/vilebrequin/women.html',
  '/brands/vilebrequin/kids.html',
  '/brands/vilebrequin/accessories.html',
  
  // Brands - DKNY
  '/brands/dkny.html',
  
  // Brands - BAYTON
  '/brands/bayton.html',
  
  // Kids
  '/kids/boys.html',
  '/kids/girls.html',
];

// Stats
let stats = {
  totalProducts: 0,
  totalImages: 0,
  uploaded: 0,
  skipped: 0,
  errors: 0,
  categories: 0,
};

// Create download directory
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clean filename for storage
 */
function cleanFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Extract product info from URL and page
 */
function extractProductInfo(url, imageUrl) {
  // Try to extract SKU from URL
  // URLs are like: /guess-noelle-mini-flap-shoulder-bag-bg840278-black.html
  const urlMatch = url.match(/([a-z]{2}\d{6})-([a-z-]+)\.html/i);
  
  let sku = '';
  let color = '';
  
  if (urlMatch) {
    sku = urlMatch[1].toUpperCase();
    color = urlMatch[2].replace(/-/g, ' ').toUpperCase();
  }
  
  // Also try to extract from image URL
  // Image URLs often contain the SKU
  const imgMatch = imageUrl.match(/([A-Z]{2}\d{6})/i);
  if (imgMatch && !sku) {
    sku = imgMatch[1].toUpperCase();
  }
  
  return { sku, color };
}

/**
 * Download image and return buffer
 */
async function downloadImage(imageUrl) {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': BASE_URL,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.buffer();
  } catch (error) {
    console.error(`    ❌ Download error: ${error.message}`);
    return null;
  }
}

/**
 * Upload image to Supabase Storage
 */
async function uploadToSupabase(buffer, filename) {
  try {
    const { data, error } = await supabase.storage
      .from('guess-images')
      .upload(`products/${filename}`, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    
    if (error) {
      if (error.message.includes('already exists')) {
        return { success: true, skipped: true };
      }
      throw error;
    }
    
    return { success: true, skipped: false };
  } catch (error) {
    console.error(`    ❌ Upload error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Add image to index table
 */
async function addToIndex(modelRef, color, filename, url) {
  try {
    const { error } = await supabase
      .from('image_index')
      .upsert({
        model_ref: modelRef,
        color: color,
        filename: filename,
        url: url,
      }, {
        onConflict: 'model_ref,color,filename',
      });
    
    if (error && !error.message.includes('duplicate')) {
      console.warn(`    ⚠️ Index error: ${error.message}`);
    }
  } catch (error) {
    console.warn(`    ⚠️ Index error: ${error.message}`);
  }
}

/**
 * Scrape a single product page for all images
 */
async function scrapeProductPage(page, productUrl) {
  try {
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2000);
    
    // Wait for images to load
    await page.evaluate(async () => {
      // Scroll to trigger lazy loading
      window.scrollBy(0, 500);
      await new Promise(r => setTimeout(r, 1000));
      window.scrollTo(0, 0);
    });
    
    await sleep(1500);
    
    // Get all product images (main + gallery)
    const images = await page.evaluate(() => {
      const imgs = new Set();
      
      // Function to clean and get full-size URL
      const getFullSizeUrl = (url) => {
        if (!url) return null;
        // Remove Magento cache/resize parameters
        return url
          .replace(/\/cache\/[a-f0-9]+\//, '/')
          .replace(/\/cache\/[^\/]+\//, '/')
          .replace(/_\d+x\d+/, '')
          .replace(/\/thumbnail\//, '/image/')
          .replace(/\/small_image\//, '/image/')
          .replace(/\?.*$/, ''); // Remove query params
      };
      
      // 1. Main product image
      const mainSelectors = [
        '.fotorama__img',
        '.product-image-main img',
        '.gallery-placeholder img',
        '.product.media img',
        '[data-gallery-role="main-image"] img',
        '.MagicZoom img',
        '#main-image',
      ];
      
      for (const sel of mainSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const src = el.src || el.dataset.src || el.dataset.full;
          const fullSrc = getFullSizeUrl(src);
          if (fullSrc) imgs.add(fullSrc);
        }
      }
      
      // 2. Gallery/thumbnail images
      const gallerySelectors = [
        '.fotorama__thumb img',
        '.fotorama__nav__frame img',
        '.product-image-thumbs img',
        '[data-gallery-role="gallery"] img',
        '.product-gallery img',
        '.swiper-slide img',
        '.thumbnails img',
      ];
      
      for (const sel of gallerySelectors) {
        document.querySelectorAll(sel).forEach(img => {
          const src = img.src || img.dataset.src || img.dataset.full;
          const fullSrc = getFullSizeUrl(src);
          if (fullSrc) imgs.add(fullSrc);
        });
      }
      
      // 3. Data attributes for high-res
      document.querySelectorAll('[data-full], [data-src], [data-image], [data-zoom-image]').forEach(el => {
        const src = el.dataset.full || el.dataset.src || el.dataset.image || el.dataset.zoomImage;
        const fullSrc = getFullSizeUrl(src);
        if (fullSrc) imgs.add(fullSrc);
      });
      
      // 4. Look in Fotorama gallery data
      const fotoramaEl = document.querySelector('[data-gallery-initial]');
      if (fotoramaEl) {
        try {
          const galleryData = JSON.parse(fotoramaEl.dataset.galleryInitial);
          if (Array.isArray(galleryData)) {
            galleryData.forEach(item => {
              if (item.full) imgs.add(item.full);
              if (item.img) imgs.add(item.img);
            });
          }
        } catch (e) {}
      }
      
      // 5. Look for any img with product in URL
      document.querySelectorAll('img[src*="/product/"]').forEach(img => {
        const fullSrc = getFullSizeUrl(img.src);
        if (fullSrc) imgs.add(fullSrc);
      });
      
      // Get product info
      // SKU - try multiple selectors
      let sku = '';
      const skuSelectors = [
        '.product-info-stock-sku .value',
        '[itemprop="sku"]',
        '.sku .value',
        '.product-sku',
        '[data-sku]',
      ];
      for (const sel of skuSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          sku = el.textContent?.trim() || el.dataset?.sku || '';
          if (sku) break;
        }
      }
      
      // Also extract SKU from page title or breadcrumb
      if (!sku) {
        const title = document.querySelector('.page-title span, h1')?.textContent || '';
        const skuMatch = title.match(/([A-Z]{2}\d{6})/i);
        if (skuMatch) sku = skuMatch[1].toUpperCase();
      }
      
      // Get product name
      const nameEl = document.querySelector('.page-title span, h1.product-name, [itemprop="name"], h1');
      let name = nameEl ? nameEl.textContent.trim() : '';
      
      // Extract color from name or elsewhere
      let color = '';
      const colorMatch = name.match(/-([A-Z]{3})-/i);
      if (colorMatch) {
        color = colorMatch[1].toUpperCase();
      }
      
      // Try color swatches
      const colorEl = document.querySelector('.swatch-option.selected, .swatch-attribute-selected-option, [data-option-label][aria-checked="true"]');
      if (colorEl) {
        color = (colorEl.dataset?.optionLabel || colorEl.getAttribute('aria-label') || colorEl.textContent || '').trim();
      }
      
      return { 
        images: [...imgs].filter(url => url && url.startsWith('http')), 
        sku, 
        name, 
        color 
      };
    });
    
    return images;
  } catch (error) {
    console.error(`    ❌ Error scraping product: ${error.message}`);
    return { images: [], sku: '', name: '', color: '' };
  }
}

/**
 * Scrape a category page for all product links
 */
async function scrapeCategoryPage(page, categoryUrl) {
  const products = [];
  let pageNum = 1;
  let hasMore = true;
  
  while (hasMore) {
    const url = pageNum === 1 ? categoryUrl : `${categoryUrl}?p=${pageNum}`;
    console.log(`  📄 Page ${pageNum}: ${url}`);
    
    try {
      await page.goto(`${BASE_URL}${url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      // Wait for products to load (site uses JavaScript)
      await sleep(3000);
      
      // Scroll to trigger lazy loading
      await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
          window.scrollBy(0, window.innerHeight);
          await new Promise(r => setTimeout(r, 500));
        }
        window.scrollTo(0, 0);
      });
      
      await sleep(2000);
      
      // Get all product links on this page - try multiple selectors
      const pageProducts = await page.evaluate(() => {
        const links = [];
        
        // Try multiple selectors for different Magento themes
        const selectors = [
          'a.product-item-link',
          '.product-item a[href*=".html"]',
          '.product-item-info a[href*=".html"]',
          'li.product-item a[href*=".html"]',
          '.products-grid a[href*=".html"]',
          '.product a[href*=".html"]',
          'a[href*=".html"][class*="product"]',
          // Specific to this site
          '[data-product-id] a[href*=".html"]',
          '.item.product a[href*=".html"]',
        ];
        
        for (const selector of selectors) {
          const productEls = document.querySelectorAll(selector);
          productEls.forEach(el => {
            const href = el.href;
            if (href && 
                href.includes('.html') && 
                !href.includes('/checkout') &&
                !href.includes('/cart') &&
                !href.includes('/customer') &&
                !links.some(p => p.url === href)) {
              
              // Try to get SKU from data attribute or URL
              const container = el.closest('.product-item, .product-item-info, li.item, [data-product-id]');
              const sku = container?.dataset?.productSku || container?.dataset?.sku || '';
              
              // Try to get image
              const img = container?.querySelector('img');
              const imgSrc = img?.src || img?.dataset?.src || '';
              
              links.push({
                url: href,
                sku: sku,
                listingImage: imgSrc,
              });
            }
          });
        }
        
        // Also look for images with product info in alt text
        const images = document.querySelectorAll('img[alt]');
        images.forEach(img => {
          const alt = img.alt || '';
          // Look for pattern like "PRODUCT NAME SKU-COLOR"
          const match = alt.match(/([A-Z]{2}\d{6})/i);
          if (match) {
            const parent = img.closest('a[href*=".html"]');
            if (parent && !links.some(p => p.url === parent.href)) {
              links.push({
                url: parent.href,
                sku: match[1].toUpperCase(),
                listingImage: img.src,
              });
            }
          }
        });
        
        return links;
      });
      
      if (pageProducts.length === 0) {
        console.log(`    ⚠️ No products found on this page`);
        hasMore = false;
      } else {
        products.push(...pageProducts);
        console.log(`    ✅ Found ${pageProducts.length} products`);
        
        // Check if there's a next page
        const hasNextPage = await page.evaluate(() => {
          const nextBtn = document.querySelector('.pages-item-next a, .action.next, a.next, [rel="next"]');
          return nextBtn !== null && !nextBtn.classList.contains('disabled');
        });
        
        if (hasNextPage && pageNum < 20) { // Limit to 20 pages per category
          pageNum++;
          await sleep(DELAY_BETWEEN_PAGES);
        } else {
          hasMore = false;
        }
      }
    } catch (error) {
      console.error(`    ❌ Error on page ${pageNum}: ${error.message}`);
      hasMore = false;
    }
  }
  
  return products;
}

/**
 * Main scraping function
 */
async function main() {
  console.log('🚀 Starting GlobalOnline.co.il Image Scraper');
  console.log('============================================\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Collect all products from all categories
  const allProducts = new Map(); // Use Map to avoid duplicates
  
  for (const category of CATEGORIES) {
    console.log(`\n📁 Category: ${category}`);
    stats.categories++;
    
    try {
      const products = await scrapeCategoryPage(page, category);
      
      for (const product of products) {
        if (!allProducts.has(product.url)) {
          allProducts.set(product.url, product);
        }
      }
      
      console.log(`  ✅ Total unique products so far: ${allProducts.size}`);
      await sleep(DELAY_BETWEEN_PAGES);
    } catch (error) {
      console.error(`  ❌ Category error: ${error.message}`);
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 Found ${allProducts.size} unique products across ${stats.categories} categories`);
  console.log(`${'='.repeat(50)}\n`);
  
  // Now scrape each product for images
  let processed = 0;
  
  for (const [productUrl, productInfo] of allProducts) {
    processed++;
    console.log(`\n[${processed}/${allProducts.size}] 🛍️ ${productUrl.split('/').pop()}`);
    
    try {
      // Scrape product page for all images
      const { images, sku, name, color } = await scrapeProductPage(page, productUrl);
      
      if (images.length === 0) {
        console.log('  ⚠️ No images found');
        continue;
      }
      
      console.log(`  📸 Found ${images.length} images, SKU: ${sku || 'N/A'}, Color: ${color || 'N/A'}`);
      stats.totalProducts++;
      
      // Download and upload each image
      let imgIndex = 0;
      for (const imageUrl of images) {
        imgIndex++;
        
        // Create filename
        let filename;
        if (sku) {
          const colorPart = color ? `_${cleanFilename(color)}` : '';
          filename = `${sku}${colorPart}_${imgIndex}.jpg`;
        } else {
          // Extract from URL
          const urlParts = productUrl.split('/').pop().replace('.html', '').split('-');
          const possibleSku = urlParts.find(p => /^[a-z]{2}\d{6}$/i.test(p));
          if (possibleSku) {
            const colorPart = color ? `_${cleanFilename(color)}` : '';
            filename = `${possibleSku.toUpperCase()}${colorPart}_${imgIndex}.jpg`;
          } else {
            filename = `${cleanFilename(productUrl.split('/').pop().replace('.html', ''))}_${imgIndex}.jpg`;
          }
        }
        
        console.log(`    📥 Downloading: ${filename}`);
        
        // Download image
        const buffer = await downloadImage(imageUrl);
        if (!buffer) {
          stats.errors++;
          continue;
        }
        
        // Upload to Supabase
        const result = await uploadToSupabase(buffer, filename);
        
        if (result.success) {
          if (result.skipped) {
            stats.skipped++;
            console.log(`    ⏭️ Already exists`);
          } else {
            stats.uploaded++;
            stats.totalImages++;
            console.log(`    ✅ Uploaded`);
            
            // Add to index
            const modelRef = sku || filename.split('_')[0];
            const imgColor = color || 'DEFAULT';
            const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/guess-images/products/${filename}`;
            await addToIndex(modelRef, imgColor, filename, publicUrl);
          }
        } else {
          stats.errors++;
        }
        
        await sleep(300); // Small delay between images
      }
      
      await sleep(DELAY_BETWEEN_PRODUCTS);
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      stats.errors++;
    }
    
    // Progress update every 50 products
    if (processed % 50 === 0) {
      console.log(`\n📊 Progress: ${processed}/${allProducts.size} products`);
      console.log(`   Uploaded: ${stats.uploaded}, Skipped: ${stats.skipped}, Errors: ${stats.errors}\n`);
    }
  }
  
  await browser.close();
  
  // Final stats
  console.log('\n' + '='.repeat(50));
  console.log('📊 FINAL STATISTICS');
  console.log('='.repeat(50));
  console.log(`Categories scraped: ${stats.categories}`);
  console.log(`Products processed: ${stats.totalProducts}`);
  console.log(`Images uploaded: ${stats.uploaded}`);
  console.log(`Images skipped (already exist): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('='.repeat(50));
}

// Run
main().catch(console.error);

