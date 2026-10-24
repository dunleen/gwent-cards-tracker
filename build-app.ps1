# === Сборка GwentCards (Tauri, релизный exe) ===
# Скрипт сам находит установленную Visual Studio Build Tools (через vswhere),
# подключает окружение MSVC и запускает сборку. Не зависит от диска установки.
# После сборки exe лежит: src-tauri\target\release\gwent-cards.exe

Set-Location -LiteralPath $PSScriptRoot

# --- инструментарий Rust и Node ---
$env:CARGO_HOME = 'D:\Rust\.cargo'
$env:RUSTUP_HOME = 'D:\Rust\.rustup'
$env:PATH = "$env:CARGO_HOME\bin;C:\Program Files\nodejs;$env:PATH"

# --- ищем vcvars64.bat ---
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$vcvars = $null
if (Test-Path $vswhere) {
    $roots = & $vswhere -products * -latest -property installationPath 2>$null
    foreach ($r in $roots) {
        $p = Join-Path $r 'VC\Auxiliary\Build\vcvars64.bat'
        if (Test-Path $p) { $vcvars = $p; break }
    }
}
# запасные варианты, если vswhere отсутствует, но MSVC установлен вручную
if (-not $vcvars -and (Test-Path 'D:\BuildTools\VC\Auxiliary\Build\vcvars64.bat')) { $vcvars = 'D:\BuildTools\VC\Auxiliary\Build\vcvars64.bat' }
if (-not $vcvars -and (Test-Path 'C:\BuildTools\VC\Auxiliary\Build\vcvars64.bat')) { $vcvars = 'C:\BuildTools\VC\Auxiliary\Build\vcvars64.bat' }

if (-not $vcvars) {
    Write-Host ''
    Write-Host 'ОШИБКА: инструменты C++ (MSVC) не найдены.' -ForegroundColor Red
    Write-Host 'Без них линковщик link.exe недоступен и exe собрать нельзя.'
    Write-Host ''
    Write-Host 'Установите Build Tools одним из способов:'
    Write-Host '  1) winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"'
    Write-Host '  2) интерактивно из установщика: компонент «Разработка классических приложений на C++»'
    Write-Host '     https://visualstudio.microsoft.com/ru/visual-studio-build-tools/'
    Write-Host 'После установки запустите этот скрипт снова.'
    exit 1
}

Write-Host "vcvars: $vcvars"

# --- применяем переменные окружения vcvars64 к текущей сессии ---
$dump = cmd /s /c "`"$vcvars`" >nul 2>&1 && set"
foreach ($line in $dump) {
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        Set-Item -Path ("env:" + $Matches[1]) -Value $Matches[2]
    }
}

Write-Host 'cargo:'
& cargo --version
if ($LASTEXITCODE -ne 0) { Write-Host 'ОШИБКА: cargo недоступен.' -ForegroundColor Red; exit 1 }
Write-Host 'node:'
& node --version
if ($LASTEXITCODE -ne 0) { Write-Host 'ОШИБКА: node недоступен.' -ForegroundColor Red; exit 1 }

Write-Host '=== сборка ==='
& npm run tauri build -- --no-bundle
$rc = $LASTEXITCODE
if ($rc -ne 0) {
    Write-Host "СБОРКА НЕ УДАЛАСЬ, код ошибки $rc" -ForegroundColor Red
    exit $rc
}
Write-Host '=== ГОТОВО ===' -ForegroundColor Green
Write-Host "exe: $PSScriptRoot\src-tauri\target\release\gwent-cards.exe"
exit 0
