@echo off
setlocal

REM ============================================================
REM PromptX Desktop - Windows packaging helper
REM
REM Default (no args): build unsigned NSIS installer (recommended)
REM Usage:
REM   package-win.bat            -> pnpm package:win:unsigned
REM   package-win.bat signed     -> pnpm package:win
REM   package-win.bat install    -> pnpm install then unsigned build
REM ============================================================

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo === PromptX Windows Packaging ===
echo Project root: %CD%
echo.

REM Try to enable corepack (safe no-op if unavailable)
where corepack >nul 2>nul && corepack enable >nul 2>nul

where pnpm >nul 2>nul || goto :no_pnpm

echo pnpm:
call pnpm -v
echo.

if /I "%~1"=="install" goto :install
if /I "%~1"=="signed" goto :signed
goto :unsigned

:install
echo Running pnpm install...
call pnpm install
if errorlevel 1 goto :fail
echo.
goto :unsigned

:signed
echo Building Windows installer (attempt signing, fallback handled by script)...
call pnpm -C apps/desktop package:win
if errorlevel 1 goto :fail
goto :done

:unsigned
echo Building unsigned Windows installer (recommended)...
call pnpm -C apps/desktop package:win:unsigned
if errorlevel 1 goto :fail
goto :done

:no_pnpm
echo [ERROR] pnpm not found. Please install Node.js and enable corepack, then run:
echo   corepack enable
echo   pnpm -v
echo.
pause
exit /b 1

:fail
echo.
echo [ERROR] Packaging failed. See output above.
echo.
pause
exit /b 1

:done
echo.
echo [OK] Packaging completed.
echo Output folder: apps\desktop\release\
echo.
pause
exit /b 0

