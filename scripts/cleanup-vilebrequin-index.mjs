#!/usr/bin/env node
/**
 * Script de NETTOYAGE de l'index VILEBREQUIN et SAM EDELMAN
 * 
 * Ce script :
 * 1. Supprime les entrées avec des couleurs incorrectes (modelRef comme couleur, DEFAULT, NULL)
 * 2. Met à jour les codes numériques vers des noms de couleur lisibles
 * 3. Vérifie et corrige les problèmes de duplication
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables Supabase manquantes');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =============================================================================
// MAPPING DES COULEURS VILEBREQUIN
// =============================================================================
const COLOR_CODE_TO_NAME = {
    '010': 'BLANC',
    '100': 'BLANC',
    '101': 'BLANC CASSE',
    '300': 'BLEU CIEL',
    '315': 'BLEU',
    '329': 'BLEU',
    '350': 'BLEU',
    '390': 'BLEU MARINE',
    '399': 'BLEU MARINE',
    '325': 'BLEU',
    '402': 'VERT',
    '410': 'VERT',
    '430': 'VERT',
    '432': 'VERT FONCE',
    '501': 'JAUNE',
    '514': 'JAUNE',
    '520': 'ORANGE',
    '540': 'ORANGE',
    '601': 'ROUGE',
    '602': 'ROUGE',
    '621': 'ROSE',
    '650': 'ROSE',
    '710': 'VIOLET',
    '750': 'GRIS',
    '780': 'GRIS FONCE',
    '800': 'MARRON',
    '990': 'NOIR',
    '999': 'NOIR',
};

// Préfixes à traiter
const PREFIXES = ['PL', 'PY', 'CR', 'MO', 'JI', 'AC', 'BM', 'FC', 'FL', 'HBSE', 'E85', 'FESE', 'SBSE'];

const stats = {
    deleted: 0,
    updated: 0,
    kept: 0,
    errors: 0,
};

/**
 * Vérifie si une couleur est invalide
 */
function isInvalidColor(color, modelRef) {
    if (!color) return true;
    
    const colorUpper = color.toUpperCase();
    const modelRefUpper = modelRef.toUpperCase();
    
    // Couleur = modelRef
    if (colorUpper === modelRefUpper) return true;
    
    // Couleurs invalides
    if (['DEFAULT', 'NULL', 'UNDEFINED'].includes(colorUpper)) return true;
    
    // Codes hébreux encodés
    if (color.includes('U05')) return true;
    
    // Code HBSE comme couleur
    if (colorUpper === 'HBSE' || colorUpper === '325') return true;
    
    return false;
}

/**
 * Convertit un code numérique en nom de couleur
 */
function convertColorCode(color) {
    if (/^\d{3}$/.test(color)) {
        return COLOR_CODE_TO_NAME[color] || null;
    }
    return color;
}

/**
 * Récupère tous les produits VILEBREQUIN et SAM EDELMAN
 */
async function getAllProducts() {
    const conditions = PREFIXES.map(p => `model_ref.ilike.${p}%`).join(',');
    
    const { data, error } = await supabase
        .from('image_index')
        .select('*')
        .or(conditions)
        .order('model_ref');
    
    if (error) throw error;
    return data || [];
}

/**
 * Supprime une entrée de l'index et du storage
 */
async function deleteEntry(entry) {
    try {
        // Supprimer du storage si le fichier existe
        if (entry.filename) {
            await supabase.storage.from('guess-images').remove([entry.filename]);
        }
        
        // Supprimer de l'index
        await supabase.from('image_index').delete().eq('id', entry.id);
        
        return true;
    } catch (error) {
        console.error(`   ❌ Erreur suppression ${entry.id}: ${error.message}`);
        return false;
    }
}

/**
 * Met à jour une couleur
 */
async function updateColor(entry, newColor) {
    try {
        await supabase
            .from('image_index')
            .update({ color: newColor })
            .eq('id', entry.id);
        return true;
    } catch (error) {
        console.error(`   ❌ Erreur mise à jour ${entry.id}: ${error.message}`);
        return false;
    }
}

/**
 * Programme principal
 */
async function main() {
    console.log('🧹 NETTOYAGE DE L\'INDEX VILEBREQUIN & SAM EDELMAN');
    console.log('='.repeat(60));
    
    // Récupérer tous les produits
    console.log('\n📦 Récupération des produits...');
    const products = await getAllProducts();
    console.log(`   ${products.length} entrées trouvées`);
    
    // Grouper par modelRef
    const grouped = {};
    for (const p of products) {
        if (!grouped[p.model_ref]) {
            grouped[p.model_ref] = [];
        }
        grouped[p.model_ref].push(p);
    }
    
    console.log(`   ${Object.keys(grouped).length} modelRefs uniques\n`);
    
    // Traiter chaque modelRef
    for (const [modelRef, entries] of Object.entries(grouped)) {
        const validEntries = entries.filter(e => !isInvalidColor(e.color, modelRef));
        const invalidEntries = entries.filter(e => isInvalidColor(e.color, modelRef));
        
        // Si toutes les entrées sont invalides
        if (validEntries.length === 0 && invalidEntries.length > 0) {
            console.log(`🔍 ${modelRef}: ${invalidEntries.length} entrées invalides (aucune valide)`);
            
            // Essayer de convertir les codes numériques
            let converted = false;
            for (const entry of invalidEntries) {
                if (/^\d{3}$/.test(entry.color)) {
                    const newColor = convertColorCode(entry.color);
                    if (newColor) {
                        console.log(`   🔄 ${entry.color} → ${newColor}`);
                        if (await updateColor(entry, newColor)) {
                            stats.updated++;
                            converted = true;
                        } else {
                            stats.errors++;
                        }
                    }
                }
            }
            
            // Si pas de conversion possible, supprimer les entrées
            if (!converted) {
                for (const entry of invalidEntries) {
                    console.log(`   🗑️ Suppression: color="${entry.color}"`);
                    if (await deleteEntry(entry)) {
                        stats.deleted++;
                    } else {
                        stats.errors++;
                    }
                }
            }
        }
        // Si on a des entrées valides et invalides
        else if (validEntries.length > 0 && invalidEntries.length > 0) {
            console.log(`🔍 ${modelRef}: ${validEntries.length} valides, ${invalidEntries.length} invalides`);
            
            // Supprimer les entrées invalides
            for (const entry of invalidEntries) {
                console.log(`   🗑️ Suppression: color="${entry.color}"`);
                if (await deleteEntry(entry)) {
                    stats.deleted++;
                } else {
                    stats.errors++;
                }
            }
            
            stats.kept += validEntries.length;
        }
        // Si toutes les entrées sont valides
        else {
            stats.kept += validEntries.length;
        }
    }
    
    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`✅ Entrées conservées:  ${stats.kept}`);
    console.log(`🔄 Entrées mises à jour: ${stats.updated}`);
    console.log(`🗑️  Entrées supprimées:  ${stats.deleted}`);
    console.log(`❌ Erreurs:             ${stats.errors}`);
    console.log('='.repeat(60));
}

main().catch(console.error);




