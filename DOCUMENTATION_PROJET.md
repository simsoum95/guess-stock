# 📋 GLOBAL BRANDS GALLERY
## Documentation Technique Complète

---

# 🎯 Vue d'ensemble

**Global Brands Gallery** est une plateforme e-commerce B2B sophistiquée permettant aux revendeurs professionnels de consulter le catalogue de produits de luxe et de passer des demandes de devis en temps réel.

### Marques partenaires
- GUESS
- SAM EDELMAN
- VILEBREQUIN
- DKNY
- BAYTON

### URL de production
🔗 https://gb-guess-stock.vercel.app/

---

# 🏗️ Architecture Technique

## Stack Technologique

| Composant | Technologie |
|-----------|-------------|
| **Framework** | Next.js 14 (App Router) |
| **Langage** | TypeScript |
| **Base de données** | Supabase (PostgreSQL) |
| **Stockage images** | Supabase Storage |
| **Source de données** | Google Sheets API |
| **Authentification** | Supabase Auth |
| **Emails** | Nodemailer (Gmail) |
| **PDF** | jsPDF + html2canvas |
| **Excel** | XLSX.js |
| **Styling** | Tailwind CSS |
| **Déploiement** | Vercel |

## Structure du projet

```
📁 app/
├── 📁 admin/                    # Panel d'administration complet
│   ├── 📁 login/                # Page de connexion sécurisée
│   ├── 📁 products/             # Gestion des 1100+ produits
│   │   ├── 📁 [modelRef]/       # Édition de produit individuel
│   │   ├── 📁 new/              # Création de nouveau produit
│   │   ├── ProductsHeader.tsx   # En-tête avec permissions
│   │   └── ProductsTable.tsx    # Tableau des produits
│   ├── 📁 orders/               # Gestion des commandes
│   │   ├── OrdersTable.tsx      # Tableau des commandes
│   │   └── page.tsx             # Page principale
│   ├── 📁 users/                # Gestion des utilisateurs
│   │   ├── 📁 [userId]/         # Configuration permissions
│   │   └── page.tsx             # Liste des utilisateurs
│   ├── layout.tsx               # Layout admin avec sidebar
│   └── page.tsx                 # Dashboard

├── 📁 api/                      # 15+ endpoints API REST
│   ├── 📁 admin/
│   │   ├── 📁 products/         # CRUD produits
│   │   ├── 📁 users/            # CRUD utilisateurs
│   │   └── 📁 setup-permissions/
│   ├── 📁 cart/
│   │   ├── 📁 export/           # Envoi commande + email
│   │   ├── 📁 delete/           # Suppression/corbeille
│   │   ├── 📁 mark-done/        # Marquer traité
│   │   └── 📁 mark-viewed/      # Marquer comme lu

├── 📁 cart/                     # Processus d'achat
│   ├── page.tsx                 # Page panier
│   ├── 📁 checkout/             # Formulaire de commande
│   └── 📁 success/              # Confirmation + PDF

├── 📁 products/                 # Catalogue public
│   ├── page.tsx                 # Page catalogue
│   └── ProductsClient.tsx       # Composant client interactif

├── globals.css                  # Styles globaux
├── layout.tsx                   # Layout racine
└── page.tsx                     # Page d'accueil

📁 components/
├── 📁 admin/
│   ├── AdminSidebar.tsx         # Navigation admin dynamique
│   ├── AutoLogout.tsx           # Déconnexion automatique
│   ├── ImageUploader.tsx        # Upload images drag & drop
│   ├── ProductForm.tsx          # Formulaire produit complet
│   └── ProductsTable.tsx        # Tableau produits admin
├── BrandLogo.tsx                # Logos des marques
├── CartIcon.tsx                 # Icône panier avec badge
└── Header.tsx                   # En-tête public

📁 hooks/
└── useCurrentAdmin.ts           # Hook permissions utilisateur

📁 lib/
├── auth.ts                      # Utilitaires authentification
├── fetchGoogleSheet.ts          # Lecture Google Sheets
├── fetchProducts.ts             # Récupération produits + images
├── googleSheetsWrite.ts         # Écriture Google Sheets
├── supabase.ts                  # Client Supabase
├── supabase-server.ts           # Client Supabase serveur
└── types.ts                     # Types TypeScript

📁 contexts/
└── CartContext.tsx              # Gestion état panier
```

---

# 🛍️ Fonctionnalités Client (Site Public)

## 1. Page d'accueil luxueuse
- Design premium avec animations CSS fluides
- Affichage élégant des 5 marques partenaires
- Bouton d'appel à l'action vers le catalogue
- Responsive (mobile, tablette, desktop)

## 2. Catalogue de produits avancé

### Volume de données
- **+1100 produits** synchronisés en temps réel

### Système de filtres multiples
- **Par marque** : GUESS, SAM EDELMAN, VILEBREQUIN, DKNY, BAYTON
- **Par catégorie** : תיק צד, ארנקים, מזוודות, סניקרס, כפכפים, נעלי עקב, etc.
- **Par famille** : pour les sacs (VIVIETTE, NOELLE, etc.)
- **Recherche textuelle** : par nom, référence, code

### Tri intelligent
1. Produits avec images en premier
2. Puis tri par stock décroissant

### Affichage produit
- Galerie d'images avec navigation
- Prix de gros affiché
- Stock en temps réel
- Bouton "Ajouter au panier"

## 3. Panier d'achat
- Ajout/suppression de produits
- Modification des quantités (+ / -)
- Calcul automatique du total
- Persistance pendant la session
- Icône panier avec badge de quantité

## 4. Processus de commande (Checkout)

### Formulaire de contact
| Champ | Description |
|-------|-------------|
| שם החנות | Nom de la boutique |
| שם פרטי | Prénom du contact |
| טלפון | Numéro de téléphone |
| שם הסוכן | Nom du vendeur (optionnel) |

### Page de confirmation
- Message de succès clair
- **Bouton télécharger PDF** (avec support hébreu parfait)
- Bouton retour au catalogue

---

# 👨‍💼 Panel d'Administration

## 1. Tableau de bord (Dashboard)

### Statistiques en temps réel
- 📊 Nombre total de produits
- 🖼️ Produits avec images
- 📋 Demandes en attente (avec badge animé)

### Alertes
- Notification des produits sans images

### Actions rapides
- Voir tous les produits
- Ajouter un produit
- Ouvrir le site public

### Graphique
- Répartition par catégorie

## 2. Gestion des produits

### Liste des produits
- Tableau complet avec toutes les informations
- Filtres : catégorie, stock, recherche
- Tri par stock (croissant/décroissant)
- Pagination

### Actions par produit
| Icône | Action | Permission requise |
|-------|--------|-------------------|
| ✏️ | Modifier | `edit_products` ou `edit_images` |
| 🗑️ | Supprimer | `edit_products` |

### Édition de produit
- **Informations générales** : nom, référence, marque, couleur
- **Catégorie et genre**
- **Prix** : détail et gros
- **Stock** : avec boutons +/-
- **Images** : 
  - Upload drag & drop
  - Preview instantané
  - Galerie multiple
  - Suppression d'images

### Boutons d'en-tête (selon permissions)
- 🟢 **Google Sheets** : lien direct vers la source de données
- 🔵 **Ajouter un produit** : création de nouveau produit

## 3. Gestion des commandes

### 3 sections distinctes

| Section | Description |
|---------|-------------|
| 📋 **בקשות בהמתנה** | Nouvelles demandes non traitées |
| ✅ **בקשות שטופלו** | Commandes marquées comme traitées |
| 🗑️ **סל המחזור** | Corbeille (suppression douce) |

### Indicateurs visuels
- 🔴 Point rouge pour les nouvelles commandes non lues
- Fond bleu pour les commandes non vues

### Informations affichées
- Date et heure
- Nom de la boutique
- Prénom du contact
- Téléphone
- Nom du סוכן
- Nombre d'articles
- Total en ₪

### Actions disponibles (selon permissions)

| Action | Bouton | Permission |
|--------|--------|------------|
| Voir les détails | פרטים | `view_orders` |
| Télécharger Excel | הורד | `export_orders` |
| Marquer traité | בוצע | `process_orders` |
| Mettre à la corbeille | 🗑️ | `delete_orders` |
| Restaurer | שחזר | `delete_orders` |
| Supprimer définitivement | מחק לצמיתות | `delete_orders` |

## 4. Gestion des utilisateurs

### Liste des utilisateurs
- Email
- Rôle (badge coloré)
- Date de création
- Actions : ⚙️ configurer, 🗑️ supprimer

### 3 rôles disponibles

| Rôle | Badge | Description |
|------|-------|-------------|
| 👑 Super Admin | Violet | Contrôle total, ne peut pas être supprimé |
| 👤 Admin | Bleu | Accès étendu |
| 👁️ Viewer | Gris | Lecture seule |

### 9 permissions granulaires

| Permission | Code | Description |
|------------|------|-------------|
| Google Sheets | `access_google_sheet` | Accès au lien Google Sheets |
| Ajouter produits | `add_products` | Créer de nouveaux produits |
| Modifier produits | `edit_products` | Modifier les informations produits |
| Modifier images | `edit_images` | Modifier uniquement les images |
| Voir commandes | `view_orders` | Accès à la liste des commandes |
| Traiter commandes | `process_orders` | Bouton "בוצע" |
| Supprimer commandes | `delete_orders` | Boutons poubelle/restaurer |
| Exporter Excel | `export_orders` | Télécharger les exports |
| Gérer utilisateurs | `manage_users` | Accès à la gestion des users |

### Page de configuration utilisateur
- Sélection du rôle (Admin / Viewer)
- Toggles visuels ON/OFF pour chaque permission
- Sauvegarde instantanée
- Protection du Super Admin

---

# 🔔 Système de notifications par email

## Configuration
- **Service** : Gmail via Nodemailer
- **Compte dédié** : guessnotif@gmail.com

## Déclenchement
- Automatique à chaque nouvelle commande

## Destinataires
- shiri@globalbg.co.il
- shimon@globalbg.co.il

## Contenu de l'email
```
📦 בקשת הצעת מחיר חדשה #[ID]

פרטי הלקוח:
- שם החנות: [nom]
- שם פרטי: [prénom]
- טלפון: [téléphone]
- שם הסוכן: [vendeur]

פריטים בהזמנה:
• [produit 1] (SKU) x[quantité] - ₪[prix]
• [produit 2] (SKU) x[quantité] - ₪[prix]
...

סה"כ: ₪[total]
```

---

# 🖼️ Système d'images avancé

## Architecture

### Stockage
- **Supabase Storage** : bucket "guess-images"
- **Dossier** : `/products/`

### Index rapide
- **Table** : `image_index`
- **Colonnes** : model_ref, color, url, filename
- **Avantage** : recherche instantanée vs listing de fichiers

### Cache
- **Durée** : 1 minute (TTL)
- **Type** : en mémoire serveur

## Matching intelligent des couleurs

### +80 correspondances configurées

```typescript
const COLOR_MAP = {
  // Noir
  "BLA": ["BLACK", "NOIR", "שחור", "BLK"],
  "BLACK": ["BLA", "BLK"],
  
  // Blanc
  "WHI": ["WHITE", "BLANC", "לבן"],
  "OFF": ["OFFWHITE", "CREAM", "IVORY"],
  
  // Marron
  "COG": ["COGNAC", "קוניאק"],
  "BRO": ["BROWN", "BRUN", "חום"],
  
  // VILEBREQUIN spécifique
  "SANTORIN": ["BLEU MARINE", "NAVY"],
  "BALLERINE": ["ROSE", "PINK"],
  "PACIFIC": ["TURQUOISE", "CYAN"],
  // ... et 70+ autres
};
```

## Règles de priorité des images

1. **Images "PZ"** (packshot) en premier
2. **Images "F"** (face) ensuite
3. Autres images après

## Upload d'images

### Fonctionnalités
- Drag & drop
- Multi-fichiers
- Preview instantané
- Barre de progression

### Nommage automatique
```
{MODELREF}-{COLOR}-{INDEX}-{TIMESTAMP}.{EXT}
Exemple: PD760221-BLA-1-1705123456789.jpg
```

### Indexation automatique
- Insertion dans `image_index` après upload
- Disponible immédiatement dans le catalogue

---

# 📄 Génération de documents

## PDF de commande

### Technologie
- **html2canvas** : capture du HTML en image
- **jsPDF** : génération du PDF

### Avantages
- ✅ Support parfait de l'hébreu (RTL)
- ✅ Rendu identique à l'écran
- ✅ Téléchargeable sur mobile et desktop

### Contenu
- En-tête avec titre
- Informations client
- Tableau des produits (nom, code, quantité, prix)
- Total

## Export Excel

### Format
- `.xlsx` standard (compatible Excel, Google Sheets, LibreOffice)

### Structure
```
Ligne 1: "פרטי הלקוח"
Ligne 2: תאריך | [date]
Ligne 3: שם החנות | [nom]
Ligne 4: שם פרטי | [prénom]
Ligne 5: טלפון | [téléphone]
Ligne 6: שם הסוכן | [vendeur]
Ligne 7: (vide)
Ligne 8: "פרטי המוצרים"
Ligne 9: שם מוצר | קוד פריט | כמות | מחיר יחידה | סה"כ
Lignes suivantes: données produits
Dernière ligne: | | | סה"כ כולל: | [total]
```

---

# 🔐 Sécurité

## Authentification

### Supabase Auth
- Email / mot de passe
- Sessions persistantes
- Tokens JWT

### Auto-logout
- Déconnexion après inactivité
- Nettoyage des cookies

### Protection des routes
- Middleware Next.js
- Vérification côté serveur

## Permissions

### Côté client
- Hook `useCurrentAdmin()`
- Chargement des permissions au montage
- UI dynamique selon les permissions

### Côté API
- Service Role Key pour opérations sensibles
- Validation des données entrantes
- Gestion des erreurs

## Bonnes pratiques
- Variables d'environnement sécurisées
- Pas de secrets dans le code
- HTTPS obligatoire

---

# 📱 Design Responsive

## Approche Mobile-First

### Breakpoints Tailwind
```css
sm: 640px   /* Petites tablettes */
md: 768px   /* Tablettes */
lg: 1024px  /* Desktop */
xl: 1280px  /* Grand écran */
```

## Adaptations mobiles

### Navigation admin
- **Desktop** : Sidebar fixe à droite
- **Mobile** : Header avec menu hamburger

### Tableaux
- Scroll horizontal sur mobile
- Colonnes prioritaires visibles

### Formulaires
- Inputs pleine largeur
- Boutons touch-friendly (min 44px)
- Espacement généreux

### Boutons
- Zone de tap élargie
- Feedback visuel au touch

---

# 🔄 Synchronisation des données

## Google Sheets → Application

### Flux
1. Requête à Google Sheets API
2. Parsing des lignes
3. Mapping vers objets Product
4. Matching avec les images Supabase
5. Rendu dans l'interface

### Cache
| Contexte | Durée |
|----------|-------|
| Admin | 30 secondes |
| Public | 2 minutes |

### Colonnes Google Sheets
- קוד גם (modelRef)
- תיאור דגם (bagName)
- מותג (brand)
- צבע (color)
- מחיר קמעונאי (priceRetail)
- מחיר סיטונאי (priceWholesale)
- כמות במלאי (stockQuantity)
- קטגוריה (subcategory)
- מגדר (gender)
- ... et autres

---

# 📊 Métriques du projet

| Métrique | Valeur |
|----------|--------|
| Fichiers TypeScript/TSX | ~50+ |
| Endpoints API | 15+ |
| Composants React | 20+ |
| Produits gérés | 1100+ |
| Marques supportées | 5 |
| Catégories | 15+ |
| Permissions configurables | 9 |
| Correspondances couleurs | 80+ |
| Lignes de code estimées | 10,000+ |

---

# 🚀 Déploiement

## Plateforme
- **Vercel** (hébergement optimisé Next.js)

## CI/CD
- Déploiement automatique à chaque push sur `main`
- Preview deployments pour les branches

## Variables d'environnement (10+)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_SHEET_ID
GOOGLE_API_KEY
GOOGLE_SHEET_NAME
GMAIL_USER
GMAIL_APP_PASSWORD
DATABASE_URL
...
```

---

# 📦 Dépendances principales

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.87.1",
    "html2canvas": "^1.4.1",
    "jspdf": "^3.0.4",
    "next": "^14.2.21",
    "nodemailer": "^7.0.12",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20",
    "@types/react": "^18.3.17",
    "@types/node": "^20.17.10",
    "googleapis": "^169.0.0",
    "pg": "^8.17.1"
  }
}
```

---

# ✨ Points forts du projet

1. **Architecture moderne** : Next.js 14 avec App Router
2. **TypeScript** : typage strict pour la fiabilité
3. **Base de données robuste** : PostgreSQL via Supabase
4. **Temps réel** : synchronisation Google Sheets
5. **Système de permissions avancé** : 9 permissions granulaires
6. **Support multilingue** : interface en hébreu, PDF en hébreu
7. **Notifications email** : alertes automatiques
8. **Export de données** : PDF et Excel
9. **Responsive** : mobile-first
10. **Sécurisé** : authentification + permissions + validation

---

**© 2024 Global Brands Gallery - Tous droits réservés**

*Ce document a été généré automatiquement et représente l'état actuel du projet.*

