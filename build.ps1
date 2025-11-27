#!/usr/bin/env pwsh

# Get current version from package.json
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$currentVersion = $packageJson.version

# Ensure builds directory structure exists
if (!(Test-Path "./builds")) {
    New-Item -ItemType Directory -Path "./builds" | Out-Null
    Write-Host "Created builds directory" -ForegroundColor Cyan
}

if (!(Test-Path "./builds/latest")) {
    New-Item -ItemType Directory -Path "./builds/latest" | Out-Null
}

if (!(Test-Path "./builds/previous")) {
    New-Item -ItemType Directory -Path "./builds/previous" | Out-Null
}

# Check builds/latest for existing version
$latestBuild = Get-ChildItem "./builds/latest" -Filter "*.vsix" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($latestBuild) {
    # Move latest to previous
    Write-Host "Moving existing latest build to previous: $($latestBuild.Name)" -ForegroundColor Yellow
    Move-Item $latestBuild.FullName "./builds/previous/" -Force
    
    # Extract version from filename (assuming format: echode-x.x.x.vsix)
    if ($latestBuild.Name -match "echode-(\d+)\.(\d+)\.(\d+)\.vsix") {
        $major = [int]$matches[1]
        $minor = [int]$matches[2]
        $patch = [int]$matches[3]
        
        # Increment patch version
        $patch++
        $newVersion = "$major.$minor.$patch"
        
        Write-Host "Incrementing version from $currentVersion to $newVersion" -ForegroundColor Green
    } else {
        $newVersion = $currentVersion
        Write-Host "Could not parse version from existing build, using current version: $newVersion" -ForegroundColor Yellow
    }
} else {
    $newVersion = $currentVersion
    Write-Host "No existing build in latest folder, using current version: $newVersion" -ForegroundColor Green
}

# Update package.json with new version
$packageJson.version = $newVersion
$packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"

Write-Host "Updated package.json version to: $newVersion" -ForegroundColor Cyan

# Build the extension
Write-Host "Building extension..." -ForegroundColor Cyan
npm run package

# Package with vsce to latest folder
$outputFile = "./builds/latest/echode-$newVersion.vsix"
Write-Host "Packaging to: $outputFile" -ForegroundColor Cyan

vsce package --out $outputFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Successfully built echode-$newVersion.vsix" -ForegroundColor Green
    Write-Host "📦 Location: $outputFile" -ForegroundColor Blue
} else {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}
