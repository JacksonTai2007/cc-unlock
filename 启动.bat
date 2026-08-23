@echo off
chcp 65001 >nul 2>&1
title cc-unlock v8.0.7 — Loop Engineering
powershell -ExecutionPolicy Bypass -File "%~dp0gui.ps1"
