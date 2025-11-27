@echo off
setlocal enabledelayedexpansion

:: Get current version from package.json
for /f "tokens=2 delims=:," %%a in ('findstr /R "\"version\"" package.json') do (
    set "version_line=%%a"
    set "version_line=!version_line: =!"
    set "current_version=!version_line:"=!"
)

:: Remove any trailing commas or whitespace
for /f "tokens=1 delims=," %%a in ("!current_version!") do set "current_version=%%a"

echo Current version: !current_version!

:: Ensure builds directory structure exists
if not exist "builds\" (
    mkdir builds
    echo Created builds directory
)

if not exist "builds\latest\" (
    mkdir builds\latest
)

if not exist "builds\previous\" (
    mkdir builds\previous
)

:: Check builds/latest for existing version
set "found_build="
for /f "delims=" %%f in ('dir /b "builds\latest\*.vsix" 2^>nul') do (
    set "filename=%%f"
    set "found_build=1"
    goto :process_latest
)

if not defined found_build (
    echo No existing build in latest folder, using current version: !current_version!
    set "new_version=!current_version!"
    goto :update_package
)

:process_latest
:: Move latest to previous
echo Moving existing latest build to previous: !filename!
move "builds\latest\!filename!" "builds\previous\" >nul

:: Extract version from filename (format: echode-x.x.x.vsix)
set "filename=!filename:echode-=!"
set "filename=!filename:.vsix=!"

:: Parse version components
for /f "tokens=1,2,3 delims=." %%a in ("!filename!") do (
    set /a "major=%%a"
    set /a "minor=%%b"
    set /a "patch=%%c"
)

:: Increment patch version
set /a "patch+=1"
set "new_version=!major!.!minor!.!patch!"

echo Incrementing version from !current_version! to !new_version!

:update_package
:: Update package.json with new version
echo Updating package.json version to: !new_version!

:: Create a temporary PowerShell script to update JSON
powershell -Command "(Get-Content 'package.json' | ConvertFrom-Json) | ForEach-Object { $_.version = '!new_version!' } | ConvertTo-Json -Depth 10 | Set-Content 'package.json'"

:: Build the extension
echo Building extension...
call npm run package

:: Package with vsce to latest folder
set "output_file=builds\latest\echode-!new_version!.vsix"
echo Packaging to: !output_file!

vsce package --out !output_file!

if !errorlevel! equ 0 (
    echo.
    echo ✅ Successfully built echode-!new_version!.vsix
    echo 📦 Location: !output_file!
) else (
    echo.
    echo ❌ Build failed
    exit /b 1
)

endlocal
