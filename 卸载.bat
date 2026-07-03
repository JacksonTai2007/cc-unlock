@echo off
echo.
echo   cc-unlock v5.0 Uninstall
echo.
echo   [1] Remove from workspace (select folder)
echo   [2] Remove from all workspaces
echo   [3] List workspaces
echo   [0] Exit
echo.
set /p "choice=  Select: "
if "%choice%"=="1" (
    powershell -ExecutionPolicy Bypass -File "%~dp0cc-unlock-files\deploy.ps1" -Uninstall -GUI
) else if "%choice%"=="2" (
    powershell -ExecutionPolicy Bypass -File "%~dp0cc-unlock-files\deploy.ps1" -Uninstall -All
) else if "%choice%"=="3" (
    powershell -ExecutionPolicy Bypass -File "%~dp0cc-unlock-files\deploy.ps1" -List
) else (
    exit /b 0
)
pause
