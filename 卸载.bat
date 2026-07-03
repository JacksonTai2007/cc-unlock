@echo off
echo.
echo   cc-unlock v5.0 Uninstall / 卸载
echo.
echo   [1] Remove from workspace (select folder) / 从指定工作区移除
echo   [2] Remove from all workspaces / 从全部工作区移除
echo   [3] List workspaces / 列出工作区
echo   [0] Exit / 退出
echo.
set /p "choice=  Select / 选择: "
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