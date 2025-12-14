# Configuration du Service Account Google pour l'écriture dans Google Sheets

Pour permettre à l'admin d'ajouter/modifier/supprimer des produits directement dans Google Sheets, vous devez configurer un Service Account.

## Étape 1 : Créer un projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Cliquez sur "Select a project" → "New Project"
3. Donnez un nom (ex: "guess-stock")
4. Cliquez sur "Create"

## Étape 2 : Activer l'API Google Sheets

1. Dans le menu de gauche, allez à "APIs & Services" → "Library"
2. Recherchez "Google Sheets API"
3. Cliquez dessus puis cliquez sur "Enable"

## Étape 3 : Créer un Service Account

1. Allez à "IAM & Admin" → "Service Accounts"
2. Cliquez sur "Create Service Account"
3. Donnez un nom (ex: "sheets-writer")
4. Cliquez sur "Create and Continue"
5. Ignorez les rôles optionnels, cliquez sur "Done"

## Étape 4 : Créer une clé JSON

1. Cliquez sur le Service Account que vous venez de créer
2. Allez à l'onglet "Keys"
3. Cliquez sur "Add Key" → "Create new key"
4. Sélectionnez "JSON" et cliquez sur "Create"
5. Le fichier JSON sera téléchargé

## Étape 5 : Partager le Google Sheet avec le Service Account

1. Ouvrez votre Google Sheet
2. Cliquez sur "Share" (Partager)
3. Copiez l'email du Service Account (format: `nom@projet-id.iam.gserviceaccount.com`)
4. Ajoutez cet email comme "Editor" (Éditeur)
5. Cliquez sur "Send" (Envoyer)

## Étape 6 : Configurer les variables d'environnement sur Vercel

1. Allez sur [Vercel Dashboard](https://vercel.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans "Settings" → "Environment Variables"
4. Ajoutez ces deux variables :

### GOOGLE_SERVICE_ACCOUNT_EMAIL
- **Key**: `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- **Value**: L'email du Service Account (trouvé dans le fichier JSON, champ `client_email`)
- Exemple: `sheets-writer@guess-stock-123456.iam.gserviceaccount.com`

### GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
- **Key**: `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- **Value**: La clé privée du Service Account (trouvée dans le fichier JSON, champ `private_key`)
- **IMPORTANT**: Copiez la valeur ENTIÈRE, y compris `-----BEGIN PRIVATE KEY-----` et `-----END PRIVATE KEY-----`
- **IMPORTANT**: Remplacez tous les `\n` littéraux par de vrais retours à la ligne, OU laissez-les tels quels (le code gère les deux cas)

5. Cliquez sur "Save"
6. Redéployez le projet

## Vérification

Après le déploiement :
1. Allez dans l'admin du site
2. Essayez d'ajouter un produit
3. Vérifiez que le produit apparaît dans Google Sheets

## Dépannage

### Erreur "Google Sheets write is not configured"
- Vérifiez que `GOOGLE_SERVICE_ACCOUNT_EMAIL` et `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` sont bien configurés dans Vercel

### Erreur "Failed to get access token"
- Vérifiez que la clé privée est correctement formatée
- Assurez-vous que l'API Google Sheets est bien activée

### Erreur "403 Forbidden" ou "Permission denied"
- Vérifiez que le Google Sheet est partagé avec l'email du Service Account en mode "Editor"

### Les changements n'apparaissent pas
- Rafraîchissez la page du catalogue
- Vérifiez directement dans Google Sheets si la ligne a été ajoutée

