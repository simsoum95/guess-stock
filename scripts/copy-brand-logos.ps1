# Script pour copier les logos de marques
# Usage: .\scripts\copy-brand-logos.ps1 -SourceFolder "C:\chemin\vers\dossier\logos"

param(
    [Parameter(Mandatory=$false)]
    [string]$SourceFolder = ""
)

$TargetFolder = "public\images\brands"
$Logos = @(
    "guess.png",
    "guess-jeans.png",
    "sam-edelman.png",
    "vilebrequin.png",
    "dkny.png",
    "bayton.png",
    "circus-ny.png",
    "gooce.png",
    "pulliez.png"
)

Write-Host "=== Copie des logos de marques ===" -ForegroundColor Cyan
Write-Host ""

if ($SourceFolder -eq "") {
    Write-Host "Aucun dossier source spécifié." -ForegroundColor Yellow
    Write-Host "Veuillez placer vos fichiers PNG dans: $TargetFolder" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Noms de fichiers requis:" -ForegroundColor Yellow
    foreach ($logo in $Logos) {
        Write-Host "  - $logo" -ForegroundColor Gray
    }
    exit
}

if (-not (Test-Path $SourceFolder)) {
    Write-Host "Erreur: Le dossier source n'existe pas: $SourceFolder" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $TargetFolder)) {
    New-Item -ItemType Directory -Path $TargetFolder -Force | Out-Null
    Write-Host "Dossier créé: $TargetFolder" -ForegroundColor Green
}

$CopiedCount = 0
$MissingCount = 0

foreach ($logo in $Logos) {
    $SourceFile = Join-Path $SourceFolder $logo
    $TargetFile = Join-Path $TargetFolder $logo
    
    if (Test-Path $SourceFile) {
        Copy-Item -Path $SourceFile -Destination $TargetFile -Force
        Write-Host "✓ Copié: $logo" -ForegroundColor Green
        $CopiedCount++
    } else {
        Write-Host "✗ Manquant: $logo" -ForegroundColor Yellow
        $MissingCount++
    }
}

Write-Host ""
Write-Host "=== Résumé ===" -ForegroundColor Cyan
Write-Host "Copiés: $CopiedCount" -ForegroundColor Green
Write-Host "Manquants: $MissingCount" -ForegroundColor $(if ($MissingCount -gt 0) { "Yellow" } else { "Green" })

if ($MissingCount -gt 0) {
    Write-Host ""
    Write-Host "Les fichiers manquants doivent être ajoutés manuellement dans: $TargetFolder" -ForegroundColor Yellow
}

