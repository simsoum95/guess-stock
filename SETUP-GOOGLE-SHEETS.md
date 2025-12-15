# Configuration Google Sheets

## 📋 Configuration requise

Pour utiliser Google Sheets comme source de données pour les produits et le stock, vous devez configurer :

### 1. **Google Sheet ID**

1. Ouvrez votre Google Sheet
2. L'URL ressemble à : `https://docs.google.com/spreadsheets/d/[ID_ICI]/edit`
3. Copiez l'ID (la partie entre `/d/` et `/edit`)

### 2. **Rendre le Sheet public en lecture** (Recommandé - Simple)

1. Dans Google Sheets, cliquez sur **"Partager"** (Share)
2. Cliquez sur **"Modifier pour tous"** → **"N'importe qui avec le lien peut voir"**
3. Cochez **"Visualiseur"** (Viewer)
4. Copiez le lien et extrayez l'ID

### 3. **Variables d'environnement**

Ajoutez dans `.env.local` :

```env
# Google Sheets Configuration
GOOGLE_SHEET_ID=ton_sheet_id_ici
GOOGLE_SHEET_NAME=Sheet1

# Supabase (pour les images uniquement)
NEXT_PUBLIC_SUPABASE_URL=https://icpedcfdavwyvkuipqiz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 📊 Format du Google Sheet

Votre Google Sheet doit avoir ces colonnes (dans la première ligne) :

| Colonne | Nom possible | Description |
|---------|--------------|-------------|
| **modelRef** | מק״ט, ModelRef, MODELREF | Code du produit |
| **color** | צבע, Color, COLOR | Couleur |
| **subcategory** | קטגוריה, Subcategory | תיק / נעל / ביגוד |
| **brand** | מותג, Brand | Marque (GUESS) |
| **priceRetail** | מחיר קמעונאי, קמעונאי | Prix de vente |
| **priceWholesale** | מחיר סיטונאי, סיטונאי | Prix de gros |
| **stockQuantity** | מלאי, כמות | Stock disponible |
| **productName** | שם מוצר, שם | Nom du produit |
| **collection** | קולקציה | Collection |
| **supplier** | ספק | Fournisseur |
| **gender** | מגדר | Genre |

**Important :** Les noms de colonnes peuvent être en anglais ou en hébreu. Le système détecte automatiquement.

## ✏️ Écriture dans Google Sheets (Admin)

Pour permettre à l'admin de modifier le stock et les prix dans Google Sheets, vous avez 2 options :

### Option 1 : Google Apps Script (Recommandé - Simple)

1. Dans votre Google Sheet, allez dans **Extensions** → **Apps Script**
2. Créez un script webhook qui accepte les mises à jour
3. Configurez une URL d'API dans votre `.env.local`

### Option 2 : Google Sheets API avec Service Account (Avancé)

1. Créez un projet Google Cloud
2. Activez Google Sheets API
3. Créez un Service Account
4. Partagez votre Google Sheet avec l'email du Service Account
5. Téléchargez les credentials JSON
6. Installez : `npm install googleapis`

**Note :** Pour l'instant, l'écriture dans Google Sheets n'est pas complètement implémentée. Le système lit depuis Google Sheets mais les modifications sont sauvegardées uniquement dans Supabase (pour les images) en attendant l'implémentation complète.

## 🖼️ Images

Les images restent sur **Supabase Storage** uniquement. Le système :
- **Lit** les produits depuis Google Sheets
- **Lit** les images depuis Supabase
- **Combine** les deux pour afficher le catalogue

## ✅ Vérification

Après configuration, vérifiez que :
1. Le Sheet est accessible publiquement
2. Les variables d'environnement sont définies
3. Le catalogue s'affiche correctement avec les données du Sheet


