@echo off
REM Сборка Tauri с окружением MSVC, установленным на D:
call "D:\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
set CARGO_HOME=D:\Rust\.cargo
set RUSTUP_HOME=D:\Rust\.rustup
set PATH=D:\Rust\.cargo\bin;C:\Program Files\nodejs;%PATH%
cd /d D:\GwentCards
echo === cargo found ===
where cargo
cargo --version
echo === сборка ===
npm run tauri build -- --no-bundle
echo === ГОТОВО, код ошибки %ERRORLEVEL% ===
