$SourceFolder = "C:\Users\1\Desktop\logo page daceuille"
$TargetFolder = "C:\Users\1\Documents\curs\public\images\brands"

Write-Host "=== Importation des logos dans l'ordre ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $TargetFolder)) {
    New-Item -ItemType Directory -Path $TargetFolder -Force | Out-Null
}

# Mapping selon l'ordre dans app/page.tsx
# Ordre actuel: GUESS (1), SAM EDELMAN (2), VILEBREQUIN (3), DKNY (4), BAYTON (5)
$LogoMapping = @{
    1 = "guess"
    2 = "sam-edelman"
    3 = "vilebrequin"
    4 = "dkny"
    5 = "bayton"
}

# Copier les fichiers dans l'ordre
for ($i = 1; $i -le 5; $i++) {
    $sourceFiles = Get-ChildItem -Path $SourceFolder -File | Where-Object {
        $_.BaseName -eq "$i"
    }
    
    if ($sourceFiles.Count -gt 0) {
        $sourceFile = $sourceFiles[0]
        $extension = $sourceFile.Extension.ToLower()
        $targetName = $LogoMapping[$i]
        $targetPath = Join-Path $TargetFolder "$targetName$extension"
        
        # Copier le fichier avec son extension originale
        Copy-Item -Path $sourceFile.FullName -Destination $targetPath -Force
        Write-Host "Copie: $($sourceFile.Name) -> $targetName$extension" -ForegroundColor Green
    } else {
        Write-Host "Fichier $i.* non trouve" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Termine ===" -ForegroundColor Green
