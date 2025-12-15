# Configuration des Variables d'Environnement sur Vercel

## Problème : Aucun produit n'apparaît après le déploiement

Si les produits fonctionnent en local mais pas sur Vercel, c'est probablement parce que les variables d'environnement ne sont pas configurées sur Vercel.

## Variables d'Environnement Requises

### 1. Aller sur Vercel Dashboard
- Allez sur https://vercel.com/dashboard
- Sélectionnez votre projet
- Allez dans **Settings** → **Environment Variables**

### 2. Ajouter ces variables :

#### Variables REQUISES :

```
GOOGLE_SHEET_ID
```
**Valeur :** L'ID de votre Google Sheet (extrait de l'URL)
- URL exemple : `https://docs.google.com/spreadsheets/d/18-jbOyUgsPAeHkn4ZQ2cioIENugZcYoGRwl_Kh9_uhw/edit`
- L'ID est : `18-jbOyUgsPAeHkn4ZQ2cioIENugZcYoGRwl_Kh9_uhw`

```
NEXT_PUBLIC_SUPABASE_URL
```
**Valeur :** Votre URL Supabase
- Exemple : `https://icpedcfdavwyvkuipqiz.supabase.co`

```
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
**Valeur :** Votre clé publique Supabase (anon key)

#### Variables OPTIONNELLES :

```
GOOGLE_SHEET_NAME
```
**Valeur :** Nom de la feuille (par défaut: `Sheet1`)
- Peut être une liste séparée par des virgules : `Sheet1,Sheet2,ביגוד`
- Ou `all` pour lire toutes les feuilles

```
SKIP_SUPABASE_IMAGES
```
**Valeur :** `true` ou `false` (par défaut: `false`)
- Si `true`, n'utilise pas les images de Supabase Storage

```
SUPABASE_SERVICE_ROLE_KEY
```
**Valeur :** Votre clé service_role Supabase (pour les opérations admin)

### 3. Important : Environnements

Pour chaque variable, sélectionnez les environnements où elle doit être disponible :
- ✅ **Production** (pour le déploiement en production)
- ✅ **Preview** (pour les branches de prévisualisation)
- ✅ **Development** (optionnel, pour le développement)

### 4. Redéployer

Après avoir ajouté les variables :
1. Allez dans **Deployments**
2. Cliquez sur les **3 points** (⋯) sur le dernier déploiement
3. Cliquez sur **Redeploy**

Ou poussez un nouveau commit sur GitHub pour déclencher un nouveau déploiement.

## Vérification

Pour vérifier que les variables sont bien configurées :
1. Allez dans **Settings** → **Environment Variables**
2. Vérifiez que toutes les variables ci-dessus sont présentes
3. Cliquez sur **View Raw** pour voir les valeurs (sans les afficher complètement pour la sécurité)

## Vérifier les Logs

Si ça ne fonctionne toujours pas :
1. Allez dans **Deployments**
2. Cliquez sur le dernier déploiement
3. Cliquez sur **View Function Logs**
4. Cherchez les erreurs liées à `GOOGLE_SHEET_ID` ou `fetchProducts`

## Test

Une fois configuré, visitez votre site déployé :
- Les produits devraient apparaître dans `/products`
- Si vous voyez une erreur, vérifiez les logs Vercel


