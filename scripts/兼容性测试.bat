@echo off
chcp 65001 >nul 2>&1
echo.
echo ============================================
echo   cc-unlock - 兼容性测试
echo ============================================
echo.

echo [1/5] PowerShell 版本检查...
PowerShell -NoProfile -Command "$PSVersionTable.PSVersion.ToString()" 2>nul
if %ERRORLEVEL% neq 0 (
    echo   FAIL: PowerShell 不可用
    goto :done
)

echo.
echo [2/5] 系统信息...
echo   OS: %OS%
echo   User: %USERNAME%
echo   Home: %USERPROFILE%

echo.
echo [3/5] Claude Code 安装检测...
set "FOUND=0"
for %%d in (
    "%USERPROFILE%\.claude"
    "%APPDATA%\claude"
    "%APPDATA%\Claude"
    "%LOCALAPPDATA%\claude"
    "%LOCALAPPDATA%\Claude"
    "%LOCALAPPDATA%\Programs\claude"
) do (
    if exist "%%~d" (
        echo   Found: %%~d
        set "FOUND=1"
    )
)
if "%FOUND%"=="0" echo   No Claude Code directories found

echo.
echo [4/5] 源文件检查...
set "BUNDLE=%~dp0..\cc-unlock-files\config-bundle"
for %%f in (CLAUDE.md system-prompt.md) do (
    if exist "%BUNDLE%\%%f" (
        for %%A in ("%BUNDLE%\%%f") do echo   OK: %%f (%%~zA bytes)
    ) else (
        echo   MISSING: %%f
    )
)

echo.
echo [5/5] 编码检查...
PowerShell -NoProfile -Command "[System.Text.Encoding]::Default.EncodingName"

echo.
echo ============================================
echo   兼容性测试完成
echo ============================================

:done
echo.
pause
