# 🔄 Guide de Réinitialisation Complète

## 🎯 Objectif

Réinitialiser complètement la base de données et repartir de zéro avec un import propre depuis Excel.

## 📋 Étapes à Suivre

### Étape 1 : Sauvegarder (IMPORTANT)

Avant de tout effacer, sauvegardez tout :

```bash
node scripts/backup-complete.mjs
```

Cela va créer un backup complet dans `data/backups/` avec toutes les données actuelles.

### Étape 2 : Vider la Base de Données

⚠️ **ATTENTION** : Cette opération supprime TOUS les produits !

```bash
node scripts/reset-complete.mjs
```

Vous devrez taper `OUI` (en majuscules) pour confirmer.

**Note** : Les images dans Supabase Storage sont CONSERVÉES.

### Étape 3 : Préparer votre Fichier Excel

Votre fichier Excel doit avoir au minimum ces colonnes :

**Obligatoires :**
- `modelRef` (ou `מק״ט` ou `קוד גם`) - Référence du modèle
- `color` (ou `צבע`) - Couleur

**Recommandées :**
- `stockQuantity` (ou `מלאי` ou `כמות מלאי נוכחי`) - Stock
- `priceWholesale` (ou `סיטונאי` ou `מחיר סיטונאי`) - Prix wholesale
- `priceRetail` (ou `מחיר קמעונאי` ou `מחיר כולל מע"מ בסיס`) - Prix retail

**Optionnelles :**
- `id` - ID unique (si vous en avez)
- `subcategory` (ou `תת משפחה`) - Sous-catégorie
- `brand` (ou `מותג`) - Marque
- `collection` (ou `קולקציה`) - Collection
- `supplier` (ou `ספק`) - Fournisseur
- `gender` (ou `מגדר`) - Genre

### Étape 4 : Importer depuis Excel

Placez votre fichier Excel dans le dossier `data/` puis :

```bash
node scripts/import-excel-final.mjs data/votre-fichier.xlsx
```

Ce script va :
- ✅ Détecter automatiquement les colonnes (hébreu ou anglais)
- ✅ Parser intelligemment les nombres (points ET virgules)
- ✅ Normaliser automatiquement les sous-catégories
- ✅ Valider toutes les valeurs
- ✅ Insérer par batch (plus rapide)

### Étape 5 : Vérifier

Après l'import, vérifiez que tout est correct :

```bash
node scripts/check-stock-values.mjs
```

## 🔍 Détection Automatique

Le système détecte automatiquement :

### Colonnes en Hébreu :
- `קולקציה` → collection
- `תת משפחה` → subcategory
- `מותג` → brand
- `קוד גם` → modelRef
- `מגדר` → gender
- `ספק` → supplier
- `צבע` → color
- `מחיר כולל מע"מ בסיס` → priceRetail
- `סיטונאי` → priceWholesale
- `כמות מלאי נוכחי` → stockQuantity

### Sous-catégories Normalisées :

**תיק** : תיק צד, תיק נשיאה, תיק גב, ארנקים, מזוודות, etc.

**נעל** : סניקרס, כפכפים, סנדלים, מגפיים, נעלי עקב, etc.

**ביגוד** : טישירט, סווטשירט, ג'קטים ומעיל, ג'ינסים, etc.

## ⚠️ Important

1. **Toujours sauvegarder avant** de vider la base
2. **Vérifier votre fichier Excel** avant l'import
3. **Tester avec un petit fichier** d'abord si possible
4. **Les images sont conservées** - elles ne seront pas supprimées

## 🆘 En cas de problème

Si quelque chose ne va pas :

1. Vérifiez les logs du script d'import
2. Regardez les erreurs affichées
3. Vérifiez que votre fichier Excel a les bonnes colonnes
4. Vous pouvez restaurer depuis le backup si nécessaire

---

**Prêt ?** Commencez par la sauvegarde, puis videz la base, puis importez votre fichier Excel propre !








