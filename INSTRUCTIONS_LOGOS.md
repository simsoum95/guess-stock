# Instructions pour ajouter les logos de marques

## Méthode 1 : Copier depuis un dossier local

Si vous avez les logos dans un dossier sur votre ordinateur :

1. Placez vos fichiers PNG dans le dossier :
   ```
   C:\Users\1\Documents\curs\public\images\brands\
   ```

2. Nommez-les exactement :
   - `guess.png`
   - `sam-edelman.png`
   - `vilebrequin.png`
   - `dkny.png`
   - `bayton.png`

## Méthode 2 : Utiliser le script PowerShell

Si vous avez un dossier avec les logos :

```powershell
cd C:\Users\1\Documents\curs
.\scripts\copy-brand-logos.ps1 -SourceFolder "C:\chemin\vers\vos\logos"
```

## Méthode 3 : Télécharger depuis le web

Si vous avez des URLs pour les logos, éditez le fichier `scripts/download-brand-logos.mjs` et ajoutez les URLs, puis exécutez :

```bash
node scripts/download-brand-logos.mjs
```

---

**Une fois les fichiers en place, les logos s'afficheront automatiquement sur la page d'accueil !**

