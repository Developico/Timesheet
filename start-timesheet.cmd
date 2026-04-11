@echo off
REM ═══════════════════════════════════════════════════
REM  Developico Timesheet — Start Development Server
REM  Port: 3000
REM ═══════════════════════════════════════════════════

echo.
echo   Developico Timesheet — Starting...
echo   ──────────────────────────────────
echo.

REM Kill any existing process on port 3000
echo   Checking port 3000...
npx kill-port 3000 >nul 2>&1

REM Start dev server
echo   Starting Next.js dev server on http://localhost:3000
echo.
cd /d "%~dp0"
pnpm dev
