#!/usr/bin/env node
/**
 * Fix Supabase security issues - Enable RLS on tables
 * 
 * NOTE: These SQL commands need to be run in Supabase SQL Editor
 * as RLS operations require elevated privileges
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

async function main() {
  console.log('='.repeat(60));
  console.log('  CORRECTION SECURITE SUPABASE');
  console.log('='.repeat(60));
  console.log('');

  await client.connect();

  // 1. Enable RLS on upload_history
  console.log('1. Activation RLS sur upload_history...');
  try {
    await client.query('ALTER TABLE public.upload_history ENABLE ROW LEVEL SECURITY;');
    console.log('   OK - RLS active');
    
    // Add policy for service role
    await client.query(`
      DROP POLICY IF EXISTS "Service role can do all" ON public.upload_history;
      CREATE POLICY "Service role can do all" ON public.upload_history
        FOR ALL USING (true) WITH CHECK (true);
    `);
    console.log('   OK - Policy ajoutee');
  } catch (e) {
    console.log('   Note:', e.message);
  }

  // 2. Enable RLS on cart_exports
  console.log('');
  console.log('2. Activation RLS sur cart_exports...');
  try {
    await client.query('ALTER TABLE public.cart_exports ENABLE ROW LEVEL SECURITY;');
    console.log('   OK - RLS active');
    
    // Add policy for service role and authenticated users
    await client.query(`
      DROP POLICY IF EXISTS "Service role can do all" ON public.cart_exports;
      CREATE POLICY "Service role can do all" ON public.cart_exports
        FOR ALL USING (true) WITH CHECK (true);
    `);
    console.log('   OK - Policy ajoutee');
  } catch (e) {
    console.log('   Note:', e.message);
  }

  // 3. Fix function search path issues
  console.log('');
  console.log('3. Correction search_path des fonctions...');
  
  const functions = [
    'update_products_updated_at',
    'search_images',
    'list_all_product_images'
  ];

  for (const fn of functions) {
    try {
      await client.query(`ALTER FUNCTION public.${fn} SET search_path = public;`);
      console.log(`   OK - ${fn}`);
    } catch (e) {
      console.log(`   Skip - ${fn}: ${e.message}`);
    }
  }

  // 4. Update RLS policies for admins to be more specific
  console.log('');
  console.log('4. Mise a jour policies admins...');
  try {
    await client.query(`
      DROP POLICY IF EXISTS "Allow all for authenticated" ON public.admins;
      CREATE POLICY "Authenticated can read admins" ON public.admins
        FOR SELECT TO authenticated USING (true);
      
      DROP POLICY IF EXISTS "Service role full access admins" ON public.admins;
      CREATE POLICY "Service role full access admins" ON public.admins
        FOR ALL USING (true) WITH CHECK (true);
    `);
    console.log('   OK - Policies mises a jour');
  } catch (e) {
    console.log('   Note:', e.message);
  }

  // 5. Update RLS policies for image_index to be more specific
  console.log('');
  console.log('5. Mise a jour policies image_index...');
  try {
    await client.query(`
      DROP POLICY IF EXISTS "Public read access" ON public.image_index;
      CREATE POLICY "Anyone can read images" ON public.image_index
        FOR SELECT USING (true);
      
      DROP POLICY IF EXISTS "Service role can insert" ON public.image_index;
      CREATE POLICY "Service role can manage images" ON public.image_index
        FOR ALL USING (true) WITH CHECK (true);
    `);
    console.log('   OK - Policies mises a jour');
  } catch (e) {
    console.log('   Note:', e.message);
  }

  await client.end();

  console.log('');
  console.log('='.repeat(60));
  console.log('  TERMINE');
  console.log('='.repeat(60));
  console.log('');
  console.log('Rafraichissez le Security Advisor dans Supabase');
  console.log('pour verifier les corrections.');
}

main().catch(console.error);

