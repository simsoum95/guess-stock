# 🔧 Guide de Réparation du Stock

## Problèmes Corrigés

1. ✅ **`update-stock/route.ts`** - Maintenant utilise Supabase au lieu du fichier JSON local
2. ✅ **`update-product/route.ts`** - Maintenant utilise Supabase au lieu du fichier JSON local  
3. ✅ **`upload-products/route.ts`** - Logique de matching simplifiée (utilise uniquement `modelRef + color`)
4. ✅ **Script de réinitialisation** - Nouveau script pour remettre tous les stocks à 0

## 📋 Étapes pour Réinitialiser le Stock

### Étape 1: Réinitialiser tous les stocks à 0

Exécutez le script de réinitialisation:

```bash
node scripts/reset-stock.mjs
```

Ce script va:
- Afficher combien de produits ont un stock > 0
- Mettre tous les stocks à 0
- **Conserver toutes les images et informations des produits**

### Étape 2: Uploader votre fichier Excel

1. Allez sur `/admin/upload`
2. Uploadez votre fichier Excel avec les bonnes valeurs de stock
3. **DÉSACTIVEZ** l'option "סנכרון מלאי" (synchronisation stock) si vous ne voulez pas que les produits absents du fichier soient mis à 0
4. Cliquez sur "העלה והרץ עדכון"

### Étape 3: Vérifier les résultats

Le système affichera:
- Combien de produits ont été mis à jour
- Combien de nouveaux produits ont été ajoutés
- Les changements effectués
- Les erreurs éventuelles

## 🔍 Format du Fichier Excel

Votre fichier Excel doit contenir au minimum:
- `modelRef` (ou `ModelRef`, `MODELREF`) - **OBLIGATOIRE**
- `color` (ou `Color`, `COLOR`) - **OBLIGATOIRE**
- `stockQuantity` (ou `StockQuantity`, `STOCKQUANTITY`, `stock`, `Stock`) - Optionnel mais recommandé

Colonnes optionnelles:
- `priceRetail`, `priceWholesale`
- `productName`
- `brand`, `subcategory`, `collection`, `supplier`, `gender`

## ⚠️ Important

- Le système utilise maintenant **uniquement `modelRef + color`** pour identifier les produits
- Les images et autres informations sont **conservées** lors des mises à jour
- Le stock est mis à jour uniquement si la valeur dans le fichier est différente

## 🐛 En cas de problème

Si vous avez encore des problèmes:

1. Vérifiez que votre fichier Excel contient bien `modelRef` et `color`
2. Vérifiez que les valeurs de stock sont des nombres (pas de texte)
3. Regardez les erreurs affichées après l'upload
4. Contactez le support si nécessaire



