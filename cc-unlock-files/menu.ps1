# cc-unlock v5.0 menu
param([switch]$Uninstall)

$deploy = Join-Path $PSScriptRoot 'deploy.ps1'

if ($Uninstall) {
    Write-Host ''
    Write-Host '  cc-unlock v5.0 Uninstall / 卸载'
    Write-Host ''
    Write-Host '  [1] Remove from workspace (select folder) / 从指定工作区移除'
    Write-Host '  [2] Remove from all workspaces / 从全部工作区移除'
    Write-Host '  [3] List workspaces / 列出工作区'
    Write-Host '  [0] Exit / 退出'
    Write-Host ''
    $c = Read-Host '  Select / 选择'
    switch ($c) {
        '1' { & $deploy -Uninstall -GUI }
        '2' { & $deploy -Uninstall -All }
        '3' { & $deploy -List }
    }
} else {
    Write-Host ''
    Write-Host '  cc-unlock v5.0'
    Write-Host '  Memory-based security research authorization'
    Write-Host '  基于 memory 的安全研究授权配置'
    Write-Host ''
    Write-Host '  [1] Deploy to workspace (select folder) / 部署到指定工作区'
    Write-Host '  [2] Deploy to all workspaces / 部署到所有工作区'
    Write-Host '  [3] Deploy Codex only / 仅部署 Codex'
    Write-Host '  [4] List workspaces / 列出工作区'
    Write-Host '  [0] Exit / 退出'
    Write-Host ''
    $c = Read-Host '  Select / 选择'
    switch ($c) {
        '1' { & $deploy -GUI }
        '2' { & $deploy -All }
        '3' { & $deploy -Codex }
        '4' { & $deploy -List }
    }
}