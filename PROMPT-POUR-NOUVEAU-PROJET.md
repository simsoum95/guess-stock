# 📋 PROMPT COMPLET POUR NOUVEAU PROJET CURSOR

Copiez-collez ce prompt dans Cursor pour votre nouveau projet :

---

## 🎯 CONTEXTE DU PROJET

Je développe une application Next.js de gestion de catalogue de produits pour une boutique GUESS. Le projet utilise Supabase comme base de données et doit gérer l'upload de fichiers Excel/Google Sheets pour mettre à jour les stocks et informations des produits.

## ⚠️ PROBLÈMES RENCONTRÉS DANS L'ANCIEN PROJET

1. **Gestion du stock incorrecte** : Les valeurs de stock étaient fausses après les uploads Excel
2. **Problèmes de matching** : Le système ne différenciait pas correctement les produits avec le même modelRef mais des IDs différents
3. **Parsing des nombres** : Problèmes avec les points et virgules (Excel vs Google Sheets)
4. **Colonnes hébreues** : Le système ne reconnaissait pas les colonnes en hébreu
5. **Sous-catégories** : Pas de normalisation automatique des sous-catégories hébreues vers les catégories principales

## ✅ FONCTIONNALITÉS REQUISES

### 1. Upload Excel/Google Sheets
- Support des fichiers `.xlsx`, `.xls`, `.csv`
- Lecture de TOUTES les feuilles Excel
- Détection automatique des colonnes (anglais ET hébreu)
- Parsing intelligent des nombres (gère points ET virgules automatiquement)
- Matching des produits par `modelRef + color` en PRIORITÉ
- Si plusieurs produits ont le même `modelRef + color`, utiliser l'ID pour différencier
- Auto-insertion des nouveaux produits non trouvés

### 2. Colonnes Supportées

**Obligatoires :**
- `modelRef` (ou `מק״ט` ou `קוד גם`) - Référence modèle
- `color` (ou `צבע`) - Couleur

**Optionnelles mais importantes :**
- `id` - ID unique (pour différencier les doublons)
- `stockQuantity` (ou `מלאי` ou `כמות מלאי נוכחי`) - Stock
- `priceWholesale` (ou `סיטונאי` ou `מחיר סיטונאי`) - Prix wholesale
- `priceRetail` (ou `מחיר קמעונאי` ou `מחיר כולל מע"מ בסיס`) - Prix retail
- `subcategory` (ou `תת משפחה`) - Sous-catégorie
- `brand` (ou `מותג`) - Marque
- `collection` (ou `קולקציה`) - Collection
- `supplier` (ou `ספק`) - Fournisseur
- `gender` (ou `מגדר`) - Genre

### 3. Normalisation des Sous-catégories

Le système doit mapper automatiquement les sous-catégories hébreues vers les catégories principales :

**תיק (Sacs)** :
- תיק צד, תיק נשיאה, תיק גב, תיק נסיעות, תיק ערב
- ארנקים, מזוודות, מחזיק מפתחות

**נעל (Chaussures)** :
- נעליים שטוחו, נעלי עקב, סניקרס, כפכפים, סנדלים, מגפיים

**ביגוד (Vêtements)** :
- טישירט, סווטשירט, חולצות, טופים
- ג'קטים ומעיל, ג'ינסים, מכנסיים, מכנסי טרנינג
- חצאיות, שמלות ואוברו, צעיפים, כובעים
- סט NEW BORN

### 4. Parsing Intelligent des Nombres

Le système doit gérer automatiquement :
- Format européen : `1.234,56` → `1234.56`
- Format US : `1,234.56` → `1234.56`
- Format simple : `1234,56` ou `1234.56`
- Espaces automatiquement supprimés
- Compatible Excel ET Google Sheets

### 5. Validations Strictes

- Stock : entre 0 et 10 000 (avertissement si > 10 000)
- Prix : entre 0 et 100 000 (avertissement si > 100 000)
- Protection contre NaN, Infinity, valeurs négatives
- Nettoyage automatique des espaces et caractères invisibles

### 6. Logique de Matching

**PRIORITÉ au modelRef + color :**
1. Chercher d'abord par `modelRef + color`
2. Si un seul produit correspond → utilisé directement
3. Si plusieurs produits ont le même `modelRef + color` → utiliser l'ID pour différencier
4. L'ID n'est utilisé QUE pour résoudre les doublons, pas en priorité

### 7. Base de Données

- Utiliser Supabase (pas de fichier JSON local)
- Table `products` avec colonnes camelCase
- Tous les endpoints API doivent utiliser Supabase directement

### 8. Interface Admin

- Dashboard avec statistiques
- Liste des produits avec filtres
- Upload Excel/CSV avec résultats détaillés
- Édition de produits
- Gestion du stock

## 🛠️ STACK TECHNIQUE

- **Framework** : Next.js 14+ (App Router)
- **Base de données** : Supabase
- **Langage** : TypeScript
- **Styling** : Tailwind CSS
- **Bibliothèques** : 
  - `xlsx` pour lire les fichiers Excel
  - `papaparse` pour les CSV
  - `@supabase/supabase-js` pour Supabase

## 📝 EXIGENCES SPÉCIFIQUES

1. **Tous les endpoints API doivent utiliser Supabase** (pas de fichiers JSON locaux)
2. **Support complet hébreu** : colonnes, sous-catégories, messages d'erreur
3. **Parsing robuste** : gère tous les formats de nombres
4. **Validations strictes** : empêche les valeurs aberrantes
5. **Matching fiable** : modelRef en priorité, ID pour les doublons
6. **Interface claire** : affichage des résultats d'upload détaillés

## 🎯 RÉSULTAT ATTENDU

Une application Next.js qui permet :
- ✅ Upload de fichiers Excel/Google Sheets avec colonnes en hébreu
- ✅ Détection automatique de toutes les colonnes
- ✅ Parsing intelligent des nombres (points et virgules)
- ✅ Normalisation automatique des sous-catégories
- ✅ Matching fiable des produits (modelRef prioritaire)
- ✅ Validations strictes pour éviter les erreurs
- ✅ Interface admin complète et fonctionnelle

## 🚀 DÉMARRAGE

Créez un nouveau projet Next.js avec TypeScript et Tailwind CSS, puis configurez Supabase. Je vous guiderai pour implémenter toutes ces fonctionnalités étape par étape.

---

**IMPORTANT** : Commencez par créer la structure de base, puis on implémentera chaque fonctionnalité une par une en testant à chaque étape.








