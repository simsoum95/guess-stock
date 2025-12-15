# 📥 Guide d'Import Excel Propre

## 🎯 Objectif

Réimporter proprement vos données depuis vos fichiers Excel/Google Sheets dans Supabase, en évitant les problèmes précédents.

## 📋 Étapes

### 1. Préparer vos fichiers

Vous pouvez me partager vos fichiers de plusieurs façons :

**Option A : Placer le fichier dans le projet**
- Placez votre fichier Excel (`.xlsx` ou `.xls`) dans le dossier `data/`
- Par exemple : `data/products.xlsx`

**Option B : Me donner le chemin complet**
- Si le fichier est ailleurs, donnez-moi le chemin complet
- Par exemple : `C:/Users/1/Desktop/products.xlsx`

**Option C : Google Sheets**
- Exportez votre Google Sheet en Excel (Fichier > Télécharger > Microsoft Excel)
- Puis utilisez l'Option A ou B

### 2. Analyser le fichier Excel

Avant d'importer, analysons le fichier pour vérifier qu'il est correct :

```bash
node scripts/analyze-excel-file.mjs data/products.xlsx
```

Ce script va :
- ✅ Afficher toutes les feuilles et colonnes
- ✅ Détecter automatiquement les colonnes importantes (ID, modelRef, color, stock, prix)
- ✅ Vérifier les valeurs suspectes
- ✅ Vous montrer des exemples de données

### 3. Import propre (Mode Test)

D'abord, testez l'import sans rien modifier :

```bash
node scripts/import-excel-clean.mjs data/products.xlsx --dry-run
```

Cela va vous montrer ce qui serait importé sans rien changer dans la base.

### 4. Import propre (Réel)

Si tout est correct, importez vraiment :

**Option A : Ajouter/Mettre à jour (recommandé)**
```bash
node scripts/import-excel-clean.mjs data/products.xlsx
```

**Option B : Tout effacer et recommencer**
```bash
node scripts/import-excel-clean.mjs data/products.xlsx --clear
```

⚠️ **ATTENTION** : `--clear` va supprimer TOUS les produits existants avant d'importer !

## 🔍 Colonnes Détectées Automatiquement

Le script détecte automatiquement ces colonnes (en cherchant différents noms) :

- **ID** : `id`, `ID`, `מזהה`, `מק״ט מלא`
- **modelRef** : `modelRef`, `ModelRef`, `מק״ט`, `ref`
- **color** : `color`, `Color`, `צבע`
- **stockQuantity** : `stockQuantity`, `stock`, `מלאי`
- **priceWholesale** : `priceWholesale`, `wholesale`, `מחיר סיטונאי`
- **priceRetail** : `priceRetail`, `retail`, `מחיר קמעונאי`
- **brand** : `brand`, `מותג`
- **subcategory** : `subcategory`, `category`, `קטגוריה`
- **collection** : `collection`, `קולקציה`

## ✅ Validations Automatiques

Le script valide automatiquement :
- ✅ Les nombres sont bien des nombres (pas de texte)
- ✅ Stock entre 0 et 10 000
- ✅ Prix entre 0 et 100 000
- ✅ Pas de valeurs négatives
- ✅ Pas de NaN ou Infinity

## 🆘 En cas de problème

Si le script ne détecte pas correctement vos colonnes :
1. Vérifiez les noms de colonnes dans votre Excel
2. Renommez-les pour qu'elles correspondent aux noms détectés
3. Ou modifiez le script `import-excel-clean.mjs` pour ajouter vos noms de colonnes

## 📊 Après l'import

Vérifiez que tout est correct :

```bash
node scripts/check-stock-values.mjs
```

Cela va afficher :
- La valeur totale du stock
- Les produits avec les valeurs les plus élevées
- Les statistiques globales

## 💡 Conseils

1. **Toujours tester d'abord** avec `--dry-run`
2. **Sauvegarder avant** avec `--clear`
3. **Vérifier les colonnes** avec `analyze-excel-file.mjs`
4. **Vérifier après** avec `check-stock-values.mjs`

## 🔄 Si vous voulez tout recommencer

Si vous voulez vraiment tout effacer et recommencer :

1. Sauvegardez d'abord (un backup existe déjà dans `data/backups/`)
2. Utilisez `--clear` lors de l'import
3. Vérifiez que tout est correct après

---

**Prêt ?** Placez votre fichier Excel dans `data/` et dites-moi le nom du fichier !



