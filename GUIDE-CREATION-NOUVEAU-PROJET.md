# 🚀 GUIDE COMPLET : CRÉER UN NOUVEAU PROJET DEPUIS ZÉRO

## 📋 ÉTAPE 1 : Créer un Nouveau Dossier

1. **Ouvrez PowerShell ou Terminal**
2. **Naviguez vers votre dossier de projets** (par exemple `Documents`)
   ```powershell
   cd C:\Users\1\Documents
   ```
3. **Créez un nouveau dossier** pour votre projet
   ```powershell
   mkdir guess-stock-v2
   cd guess-stock-v2
   ```

## 📋 ÉTAPE 2 : Initialiser le Projet Next.js

1. **Créez un nouveau projet Next.js avec TypeScript et Tailwind**
   ```powershell
   npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
   ```
   
   **Répondez aux questions :**
   - ✅ Would you like to use ESLint? → **Yes**
   - ✅ Would you like to use `src/` directory? → **No** (on a déjà dit --no-src-dir)
   - ✅ Would you like to use App Router? → **Yes** (déjà activé avec --app)
   - ✅ Would you like to customize the default import alias? → **No** (déjà configuré)

2. **Attendez que l'installation se termine**

## 📋 ÉTAPE 3 : Installer les Dépendances Nécessaires

```powershell
npm install @supabase/supabase-js xlsx papaparse
npm install -D @types/papaparse
```

## 📋 ÉTAPE 4 : Configurer Supabase

1. **Créez un fichier `.env.local`** à la racine du projet :
   ```env
   NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
   SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
   ```

2. **Créez le fichier de configuration Supabase** : `lib/supabase.ts`
   ```typescript
   import { createClient } from '@supabase/supabase-js'

   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

   export const supabase = createClient(supabaseUrl, supabaseAnonKey)

   // Pour les opérations admin (service role)
   const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
   export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
   ```

## 📋 ÉTAPE 5 : Ouvrir dans Cursor

1. **Ouvrez Cursor**
2. **File → Open Folder**
3. **Sélectionnez le dossier** `guess-stock-v2` que vous venez de créer
4. **Ouvrez le chat Cursor** (Ctrl+L ou Cmd+L)

## 📋 ÉTAPE 6 : Utiliser le Prompt dans Cursor

**Copiez-collez ce prompt complet dans le chat Cursor :**

```
Je développe une application Next.js de gestion de catalogue de produits pour une boutique GUESS. Le projet utilise Supabase comme base de données et doit gérer l'upload de fichiers Excel/Google Sheets pour mettre à jour les stocks et informations des produits.

PROBLÈMES À ÉVITER :
1. Gestion du stock incorrecte après les uploads Excel
2. Problèmes de matching : ne pas différencier les produits avec le même modelRef mais des IDs différents
3. Parsing des nombres : gérer les points ET virgules (Excel vs Google Sheets)
4. Colonnes hébreues : reconnaître automatiquement les colonnes en hébreu
5. Normalisation : mapper automatiquement les sous-catégories hébreues vers les catégories principales (תיק, נעל, ביגוד)

FONCTIONNALITÉS REQUISES :

1. Upload Excel/Google Sheets :
   - Support .xlsx, .xls, .csv
   - Lecture de TOUTES les feuilles Excel
   - Détection automatique des colonnes (anglais ET hébreu)
   - Parsing intelligent des nombres (gère points ET virgules automatiquement)
   - Matching des produits par modelRef + color en PRIORITÉ
   - Si plusieurs produits ont le même modelRef + color, utiliser l'ID pour différencier
   - Auto-insertion des nouveaux produits non trouvés

2. Colonnes Supportées :
   - Obligatoires : modelRef (ou מק״ט ou קוד גם), color (ou צבע)
   - Optionnelles : id, stockQuantity (ou מלאי ou כמות מלאי נוכחי), priceWholesale (ou סיטונאי), priceRetail (ou מחיר קמעונאי ou מחיר כולל מע"מ בסיס), subcategory (ou תת משפחה), brand (ou מותג), collection (ou קולקציה), supplier (ou ספק), gender (ou מגדר)

3. Normalisation des Sous-catégories :
   - תיק : תיק צד, תיק נשיאה, תיק גב, תיק נסיעות, תיק ערב, ארנקים, מזוודות, מחזיק מפתחות
   - נעל : נעליים שטוחו, נעלי עקב, סניקרס, כפכפים, סנדלים, מגפיים
   - ביגוד : טישירט, סווטשירט, חולצות, טופים, ג'קטים ומעיל, ג'ינסים, מכנסיים, מכנסי טרנינג, חצאיות, שמלות ואוברו, צעיפים, כובעים, סט NEW BORN

4. Parsing Intelligent des Nombres :
   - Format européen : 1.234,56 → 1234.56
   - Format US : 1,234.56 → 1234.56
   - Format simple : 1234,56 ou 1234.56
   - Espaces automatiquement supprimés
   - Compatible Excel ET Google Sheets

5. Validations Strictes :
   - Stock : entre 0 et 10 000 (avertissement si > 10 000)
   - Prix : entre 0 et 100 000 (avertissement si > 100 000)
   - Protection contre NaN, Infinity, valeurs négatives

6. Logique de Matching :
   - PRIORITÉ au modelRef + color
   - Si un seul produit correspond → utilisé directement
   - Si plusieurs produits ont le même modelRef + color → utiliser l'ID pour différencier
   - L'ID n'est utilisé QUE pour résoudre les doublons, pas en priorité

7. Base de Données :
   - Utiliser Supabase (pas de fichier JSON local)
   - Tous les endpoints API doivent utiliser Supabase directement
   - Table products avec colonnes camelCase

8. Interface Admin :
   - Dashboard avec statistiques (total produits, total stock, valeur totale)
   - Liste des produits avec filtres (catégorie, recherche)
   - Upload Excel/CSV avec résultats détaillés (produits créés, mis à jour, erreurs)
   - Édition de produits
   - Gestion du stock

STACK : Next.js 14+ (App Router), TypeScript, Tailwind CSS, Supabase, xlsx, papaparse

Créez la structure complète du projet avec :
1. Configuration Supabase (lib/supabase.ts)
2. Types TypeScript (lib/types.ts)
3. Fonction de parsing intelligent des nombres
4. Fonction de normalisation des catégories
5. API route pour upload Excel (/api/admin/upload-products)
6. API route pour update stock (/api/admin/update-stock)
7. API route pour update product (/api/admin/update-product)
8. Page admin dashboard (/app/admin/page.tsx)
9. Page admin upload (/app/admin/upload/page.tsx)
10. Page admin produits (/app/admin/products/page.tsx)

Implémentez toutes ces fonctionnalités étape par étape en testant à chaque étape.
```

## 📋 ÉTAPE 7 : Structure de Fichiers Attendue

Après que Cursor ait créé le projet, vous devriez avoir cette structure :

```
guess-stock-v2/
├── app/
│   ├── admin/
│   │   ├── page.tsx          (Dashboard)
│   │   ├── upload/
│   │   │   └── page.tsx       (Page upload Excel)
│   │   └── products/
│   │       └── page.tsx       (Liste produits)
│   ├── api/
│   │   └── admin/
│   │       ├── upload-products/
│   │       │   └── route.ts
│   │       ├── update-stock/
│   │       │   └── route.ts
│   │       └── update-product/
│   │           └── route.ts
│   └── layout.tsx
├── lib/
│   ├── supabase.ts           (Configuration Supabase)
│   ├── types.ts              (Types TypeScript)
│   └── fetchProducts.ts      (Fonction fetch produits)
├── .env.local                (Variables d'environnement)
├── package.json
└── tsconfig.json
```

## 📋 ÉTAPE 8 : Vérifier la Base de Données Supabase

Assurez-vous que votre table `products` dans Supabase a cette structure :

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  modelRef TEXT NOT NULL,
  color TEXT NOT NULL,
  stockQuantity INTEGER DEFAULT 0,
  priceRetail DECIMAL(10,2) DEFAULT 0,
  priceWholesale DECIMAL(10,2) DEFAULT 0,
  category TEXT CHECK (category IN ('תיק', 'נעל', 'ביגוד')),
  subcategory TEXT,
  brand TEXT,
  collection TEXT,
  supplier TEXT,
  gender TEXT,
  imageUrl TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_modelref_color ON products(modelRef, color);
CREATE INDEX idx_category ON products(category);
```

## ✅ CHECKLIST FINALE

- [ ] Nouveau dossier créé
- [ ] Projet Next.js initialisé
- [ ] Dépendances installées
- [ ] Fichier .env.local configuré avec les clés Supabase
- [ ] Projet ouvert dans Cursor
- [ ] Prompt envoyé à Cursor
- [ ] Structure de fichiers créée
- [ ] Table Supabase créée
- [ ] Test d'upload Excel réussi

## 🎯 PROCHAINES ÉTAPES

Une fois que Cursor a créé la structure de base :
1. Testez l'upload avec un petit fichier Excel
2. Vérifiez que les produits sont bien créés dans Supabase
3. Testez le matching avec des produits existants
4. Vérifiez le parsing des nombres avec différents formats
5. Testez avec des colonnes en hébreu

---

**IMPORTANT** : Ne copiez PAS les fichiers de l'ancien projet. Laissez Cursor créer tout depuis zéro avec le prompt complet.




