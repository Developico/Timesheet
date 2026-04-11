@echo off
REM ═══════════════════════════════════════════════════
REM  Developico Timesheet — Stop Development Server
REM  Port: 3000
REM ═══════════════════════════════════════════════════

echo.
echo   Developico Timesheet — Stopping...
echo   ──────────────────────────────────
echo.

echo   Killing process on port 3000...
npx kill-port 3000
if %ERRORLEVEL% EQU 0 (
    echo   Port 3000 freed successfully.
) else (
    echo   No process found on port 3000.
)

echo.
echo   Done.
echo.
