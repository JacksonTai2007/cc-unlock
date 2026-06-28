@echo off
chcp 65001 >nul 2>&1
echo.
echo ============================================
echo   cc-unlock - Quick Test
echo ============================================
echo.

set "CLAUDE_DIR=%USERPROFILE%\.claude"

echo [1/4] Checking config directory...
if exist "%CLAUDE_DIR%" (
    echo   OK: %CLAUDE_DIR% exists
) else (
    echo   FAIL: %CLAUDE_DIR% not found
    goto :done
)

echo.
echo [2/4] Checking core files...
set "PASS=0"
set "TOTAL=0"

for %%f in (CLAUDE.md system-prompt.md config.toml settings.json) do (
    set /a TOTAL+=1
    if exist "%CLAUDE_DIR%\%%f" (
        echo   OK: %%f
        set /a PASS+=1
    ) else (
        echo   MISSING: %%f
    )
)

echo.
echo [3/4] Checking file sizes...
for %%f in (CLAUDE.md system-prompt.md) do (
    if exist "%CLAUDE_DIR%\%%f" (
        for %%A in ("%CLAUDE_DIR%\%%f") do (
            if %%~zA GTR 1000 (
                echo   OK: %%f = %%~zA bytes
            ) else (
                echo   WARN: %%f = %%~zA bytes (seems too small)
            )
        )
    )
)

echo.
echo [4/4] Checking backups...
if exist "%CLAUDE_DIR%\backups" (
    dir /b /ad "%CLAUDE_DIR%\backups\cc-unlock-*" 2>nul | find /c /v "" > "%TEMP%\cc-unlock-count.tmp"
    set /p BCOUNT=<"%TEMP%\cc-unlock-count.tmp"
    del "%TEMP%\cc-unlock-count.tmp" 2>nul
    echo   Backups found
) else (
    echo   No backups directory
)

echo.
echo ============================================
echo   Test complete: %PASS%/%TOTAL% files present
echo ============================================

:done
echo.
pause
