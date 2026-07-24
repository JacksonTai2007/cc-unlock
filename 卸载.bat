@echo off
chcp 65001 >nul 2>&1
title cc-unlock v8.0.6 — Uninstall
powershell -ExecutionPolicy Bypass -File "%~dp0cc-unlock-files\deploy.ps1" -Uninstall -All
pause
