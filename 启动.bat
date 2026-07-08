@echo off
chcp 65001 >nul 2>&1
title cc-unlock v6.0 — Loop Engineering
powershell -ExecutionPolicy Bypass -File "%~dp0gui.ps1"
