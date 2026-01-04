$SourceFolder = "C:\Users\1\Desktop\logo page daceuille"
$TargetFolder = "C:\Users\1\Documents\curs\public\images\brands"

Write-Host "=== Importation des logos de marques ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $TargetFolder)) {
    New-Item -ItemType Directory -Path $TargetFolder -Force | Out-Null
    Write-Host "Dossier cree: $TargetFolder" -ForegroundColor Green
}

$ImageFiles = Get-ChildItem -Path $SourceFolder -File | Where-Object {
    $_.Extension -match '\.(png|jpg|jpeg|avif|webp)$'
}

Write-Host "Fichiers trouves:" -ForegroundColor Yellow
foreach ($file in $ImageFiles) {
    Write-Host "  - $($file.Name)" -ForegroundColor Gray
}
Write-Host ""

$CopiedCount = 0

foreach ($file in $ImageFiles) {
    $fileName = $file.BaseName.ToLower()
    $extension = $file.Extension.ToLower()
    $targetName = $null
    
    if ($fileName -like "*vilebrequin*") {
        $targetName = "vilebrequin.png"
    }
    elseif ($fileName -like "*bayton*") {
        $targetName = "bayton.png"
    }
    elseif ($fileName -like "*guess*") {
        if ($fileName -notlike "*jeans*") {
            $targetName = "guess.png"
        }
    }
    elseif ($fileName -like "*edelman*" -or $fileName -like "*sam*") {
        $targetName = "sam-edelman.png"
    }
    elseif ($fileName -like "*dkny*" -or $fileName -like "*donna*" -or $fileName -like "*karan*") {
        $targetName = "dkny.png"
    }
    
    if ($targetName) {
        $targetPath = Join-Path $TargetFolder $targetName
        Copy-Item -Path $file.FullName -Destination $targetPath -Force
        Write-Host "Copie: $($file.Name) -> $targetName" -ForegroundColor Green
        $CopiedCount++
    } else {
        Write-Host "Non identifie: $($file.Name)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Resume ===" -ForegroundColor Cyan
Write-Host "Fichiers copies: $CopiedCount" -ForegroundColor Green

$RequiredLogos = @("guess.png", "sam-edelman.png", "vilebrequin.png", "dkny.png", "bayton.png")
$MissingLogos = @()

foreach ($logo in $RequiredLogos) {
    $logoPath = Join-Path $TargetFolder $logo
    if (-not (Test-Path $logoPath)) {
        $MissingLogos += $logo
    }
}

if ($MissingLogos.Count -gt 0) {
    Write-Host ""
    Write-Host "Logos manquants:" -ForegroundColor Yellow
    foreach ($logo in $MissingLogos) {
        Write-Host "  - $logo" -ForegroundColor Yellow
    }
}
