# 🔍 Guide de Vérification du Fichier Excel

## Problème : Valeur du stock anormalement élevée

Si après l'upload de votre fichier Excel, la valeur totale du stock a augmenté de manière suspecte (ex: +2 000 000 shekels), voici comment vérifier et corriger :

## ✅ Vérifications à faire dans votre fichier Excel

### 1. Format des colonnes de stock

La colonne `stockQuantity` (ou `stock`) doit contenir **uniquement des nombres entiers** :
- ✅ **Correct** : `12`, `0`, `5`, `100`
- ❌ **Incorrect** : `"12"`, `12.5`, `12,5`, ` 12 `, `12 unités`, `12.0`

### 2. Format des colonnes de prix

Les colonnes `priceWholesale` et `priceRetail` doivent contenir **uniquement des nombres décimaux** :
- ✅ **Correct** : `549.95`, `1000`, `0`
- ❌ **Incorrect** : `"549.95"`, `549,95`, `₪549.95`, ` 549.95 `, `549.95 NIS`

### 3. Vérifier les valeurs suspectes

**Limites raisonnables :**
- Stock : entre 0 et 10 000 unités
- Prix : entre 0 et 100 000 shekels

Si vous avez des valeurs au-delà de ces limites, le système affichera un avertissement mais les acceptera.

### 4. Vérifier les espaces et caractères invisibles

Parfois Excel ajoute des espaces invisibles. Pour vérifier :
1. Sélectionnez une cellule avec une valeur suspecte
2. Regardez dans la barre de formule en haut
3. Vérifiez qu'il n'y a pas d'espaces avant/après le nombre

### 5. Vérifier les formules Excel

Assurez-vous que les cellules contiennent des **valeurs** et non des **formules** :
- ❌ `=A1*2` (formule)
- ✅ `24` (valeur)

## 🔧 Comment corriger

### Option 1 : Nettoyer le fichier Excel

1. Sélectionnez toutes les colonnes numériques (stock, prix)
2. Utilisez "Rechercher et remplacer" (Ctrl+H) :
   - Chercher : `,` (virgule)
   - Remplacer par : `.` (point)
3. Supprimez tous les espaces
4. Vérifiez que les cellules sont au format "Nombre" (pas "Texte")

### Option 2 : Réinitialiser le stock

Si vous avez déjà uploadé un fichier avec des erreurs :

1. Exécutez le script de réinitialisation :
   ```bash
   node scripts/reset-stock.mjs
   ```

2. Corrigez votre fichier Excel

3. Re-uploadez le fichier corrigé

## 📊 Vérifier la valeur totale actuelle

Pour voir la valeur totale actuelle du stock :

```bash
node scripts/check-stock-values.mjs
```

## ⚠️ Points d'attention

1. **Ne pas mélanger les formats** : Si vous utilisez des points pour les décimales, utilisez-les partout
2. **Pas de texte dans les colonnes numériques** : Même "0" en texte peut causer des problèmes
3. **Vérifier après l'upload** : Regardez les erreurs et avertissements affichés après l'upload
4. **Sauvegarder avant** : Toujours sauvegarder votre fichier Excel avant de l'uploader

## 🆘 En cas de problème persistant

Si le problème persiste après avoir vérifié tout ce qui précède :

1. Vérifiez les logs de l'upload (dans la console du navigateur ou les logs serveur)
2. Regardez les erreurs affichées après l'upload
3. Vérifiez qu'il n'y a pas de produits dupliqués dans votre fichier Excel


