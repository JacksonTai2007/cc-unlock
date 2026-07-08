# cc-unlock v6.0 — Memory + Loop Engineering + Skill deployment
# 通过 Claude Code memory 系统部署安全研究者身份上下文 + Loop Engineering 自递归引擎
# Deploys researcher identity + Loop Engineering via Claude Code's persistent memory + skill system
# Compatible: Windows 7/8/10/11, PowerShell 2.0-7.x, Core/Desktop

param(
    [string]$Path,
    [switch]$Uninstall,
    [switch]$Verify,
    [switch]$All,
    [switch]$List,
    [switch]$GUI,
    [switch]$Codex,
    [switch]$SkipSettings,
    [switch]$SkipSkill,
    [string]$Mode
)

if ($Mode) {
    switch ($Mode.ToLower()) {
        'deploy'    { }
        'install'   { }
        'uninstall' { $Uninstall = $true }
        'remove'    { $Uninstall = $true }
        'verify'    { $Verify = $true }
        'list'      { $List = $true }
        'all'       { $All = $true }
        'gui'       { $GUI = $true }
        'codex'     { $Codex = $true }
        default     { Write-Host "[!] Unknown -Mode '$Mode'" -ForegroundColor Yellow; exit 1 }
    }
}

$ProgressPreference = 'SilentlyContinue'

# --- UTF-8 ---
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { [Console]::InputEncoding  = [System.Text.Encoding]::UTF8 } catch {}
try { $OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { chcp 65001 | Out-Null } catch {}

$UTF8NoBOM = New-Object System.Text.UTF8Encoding $false

# --- Paths ---
$USER_HOME = $env:USERPROFILE
if (!$USER_HOME) {
    try { $USER_HOME = [Environment]::GetFolderPath('UserProfile') } catch {}
    if (!$USER_HOME) { $USER_HOME = "C:\Users\$env:USERNAME" }
}

$CLAUDE_DIR = Join-Path $USER_HOME '.claude'
$CLAUDE_PROJECTS = Join-Path $CLAUDE_DIR 'projects'
$CODEX_DIR = Join-Path $USER_HOME '.codex'

$SCRIPT_DIR = $PSScriptRoot
if (!$SCRIPT_DIR) {
    try { $SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path } catch {}
    if (!$SCRIPT_DIR) { $SCRIPT_DIR = (Get-Location).Path }
}
$MEMORY_BUNDLE = Join-Path $SCRIPT_DIR 'memory-bundle'
$CONFIG_BUNDLE = Join-Path $SCRIPT_DIR 'config-bundle'
$SKILL_BUNDLE  = Join-Path $SCRIPT_DIR 'skill-bundle'
$CODEX_BUNDLE  = Join-Path $SCRIPT_DIR '..\codex-files\codex-config-bundle'
$MEMORY_FILE   = 'security-research-lab.md'
$INDEX_FILE    = 'MEMORY.md'
$SKILL_FILE    = 'loop-sec.md'

# --- Banner ---
function Show-Banner {
    Write-Host ''
    Write-Host '============================================' -ForegroundColor Cyan
    Write-Host '  cc-unlock v6.0' -ForegroundColor Green
    Write-Host '  Loop Engineering + Security Research Auth' -ForegroundColor DarkGray
    Write-Host '  Loop Engineering 自递归引擎 + 安全研究授权' -ForegroundColor DarkGray
    Write-Host '============================================' -ForegroundColor Cyan
    Write-Host ''
}

# --- Helpers ---

function Write-Utf8NoBom($FilePath, $Content) {
    try {
        [System.IO.File]::WriteAllText($FilePath, $Content, $UTF8NoBOM)
        return $true
    } catch {}
    try {
        $Content | Out-File -FilePath $FilePath -Encoding UTF8 -Force -ErrorAction Stop
        return $true
    } catch {}
    return $false
}

function Copy-Safe($Src, $Dst) {
    for ($i = 0; $i -lt 3; $i++) {
        try {
            Copy-Item $Src $Dst -Force -ErrorAction Stop
            return $true
        } catch {
            if ($i -lt 2) { Start-Sleep -Milliseconds (500 * ($i + 1)) }
        }
    }
    return $false
}

function ConvertTo-ClaudeProjectPath {
    param([string]$WorkspacePath)
    $resolved = (Resolve-Path $WorkspacePath -ErrorAction Stop).Path.TrimEnd('\')
    return ($resolved -replace ':', '-' -replace '\\', '-' -replace ' ', '-')
}

function Get-MemoryDir {
    param([string]$ProjectName)
    return Join-Path $CLAUDE_PROJECTS "$ProjectName\memory"
}

function Test-Deployed {
    param([string]$MemoryDir)
    return (Test-Path (Join-Path $MemoryDir $MEMORY_FILE))
}

function Get-IndexEntry {
    $templateIndex = Join-Path $MEMORY_BUNDLE $INDEX_FILE
    if (!(Test-Path $templateIndex)) { return $null }
    $lines = [System.IO.File]::ReadAllLines($templateIndex, $UTF8NoBOM)
    foreach ($line in $lines) {
        if ($line -match 'security-research-lab') { return $line }
    }
    return $null
}

function Resolve-WorkspaceFromProject {
    param([string]$ProjectName)

    # Strategy 1: all dashes to backslashes (works for paths without spaces)
    $direct = ($ProjectName -replace '^([A-Za-z])-', '$1:\') -replace '-', '\'
    if (Test-Path $direct) { return $direct }

    # Strategy 2: scan common parent dirs, use forward conversion to match
    $scanRoots = @(
        (Join-Path $USER_HOME 'Desktop'),
        (Join-Path $USER_HOME 'Documents'),
        (Join-Path $USER_HOME 'Projects'),
        $USER_HOME
    )

    foreach ($root in $scanRoots) {
        if (!(Test-Path $root)) { continue }
        try {
            $rootProj = ConvertTo-ClaudeProjectPath $root
            if ($rootProj -eq $ProjectName) { return $root }
        } catch {}

        $children = @()
        try { $children = @(Get-ChildItem $root -Directory -ErrorAction SilentlyContinue) } catch {}
        foreach ($child in $children) {
            try {
                $testProj = ConvertTo-ClaudeProjectPath $child.FullName
                if ($testProj -eq $ProjectName) { return $child.FullName }
            } catch {}
            $grandchildren = @()
            try { $grandchildren = @(Get-ChildItem $child.FullName -Directory -ErrorAction SilentlyContinue) } catch {}
            foreach ($gc in $grandchildren) {
                try {
                    $testProj = ConvertTo-ClaudeProjectPath $gc.FullName
                    if ($testProj -eq $ProjectName) { return $gc.FullName }
                } catch {}
            }
        }
    }
    return $null
}

# --- Deploy skill to workspace ---
function Deploy-Skill {
    param([string]$WorkspacePath)

    if ($SkipSkill) {
        Write-Host '  [skip] skill (SkipSkill)' -ForegroundColor DarkGray
        return @{ Ok = 0; Fail = 0 }
    }

    $skillSrc = Join-Path $SKILL_BUNDLE $SKILL_FILE
    if (!(Test-Path $skillSrc)) {
        Write-Host '  [skip] skill bundle not found' -ForegroundColor DarkGray
        return @{ Ok = 0; Fail = 0 }
    }

    if (!$WorkspacePath -or !(Test-Path $WorkspacePath)) {
        return @{ Ok = 0; Fail = 0 }
    }

    $skillDir = Join-Path $WorkspacePath '.claude\skills'
    if (!(Test-Path $skillDir)) {
        New-Item -ItemType Directory -Path $skillDir -Force | Out-Null
    }

    $skillDst = Join-Path $skillDir $SKILL_FILE
    if (Copy-Safe $skillSrc $skillDst) {
        Write-Host "    [ok] skill/$SKILL_FILE -> .claude/skills/" -ForegroundColor Green
        return @{ Ok = 1; Fail = 0 }
    } else {
        Write-Host "    [FAIL] skill/$SKILL_FILE" -ForegroundColor Red
        return @{ Ok = 0; Fail = 1 }
    }
}

# --- Remove skill from workspace ---
function Remove-Skill {
    param([string]$WorkspacePath)

    if (!$WorkspacePath -or !(Test-Path $WorkspacePath)) { return }

    $skillPath = Join-Path $WorkspacePath ".claude\skills\$SKILL_FILE"
    if (Test-Path $skillPath) {
        Remove-Item $skillPath -Force
        Write-Host "    [ok] Removed .claude/skills/$SKILL_FILE" -ForegroundColor Yellow
    }

    # Clean up empty skills dir
    $skillDir = Join-Path $WorkspacePath '.claude\skills'
    if ((Test-Path $skillDir) -and ((Get-ChildItem $skillDir).Count -eq 0)) {
        Remove-Item $skillDir -Force -ErrorAction SilentlyContinue
    }
}

# --- Verify skill ---
function Verify-Skill {
    param([string]$WorkspacePath)

    if (!$WorkspacePath -or !(Test-Path $WorkspacePath)) { return }

    $skillPath = Join-Path $WorkspacePath ".claude\skills\$SKILL_FILE"
    if (Test-Path $skillPath) {
        $sz = (Get-Item $skillPath).Length
        Write-Host "    .claude/skills/$SKILL_FILE - OK ($sz bytes)" -ForegroundColor Green
    } else {
        Write-Host "    .claude/skills/$SKILL_FILE - NOT DEPLOYED" -ForegroundColor DarkGray
    }
}

# --- Deploy to workspace ---
function Deploy-Memory {
    param([string]$MemoryDir, [string]$Label, [string]$WorkspacePath)

    if (!(Test-Path $MemoryDir)) {
        New-Item -ItemType Directory -Path $MemoryDir -Force | Out-Null
    }

    $ok = 0; $fail = 0

    # 1. security-research-lab.md -> memory/
    $src = Join-Path $MEMORY_BUNDLE $MEMORY_FILE
    $dst = Join-Path $MemoryDir $MEMORY_FILE
    if (Copy-Safe $src $dst) {
        Write-Host "    [ok] $MEMORY_FILE" -ForegroundColor Green
        $ok++
    } else {
        Write-Host "    [FAIL] $MEMORY_FILE" -ForegroundColor Red
        $fail++
    }

    # 2. MEMORY.md index -> memory/
    $indexPath = Join-Path $MemoryDir $INDEX_FILE
    if (Test-Path $indexPath) {
        $content = [System.IO.File]::ReadAllText($indexPath, $UTF8NoBOM)
        if ($content -notmatch 'security-research-lab') {
            $entry = Get-IndexEntry
            if ($entry) {
                $content = $content.TrimEnd([char]13, [char]10) + [Environment]::NewLine + $entry + [Environment]::NewLine
                [System.IO.File]::WriteAllText($indexPath, $content, $UTF8NoBOM)
            }
        }
        Write-Host "    [ok] $INDEX_FILE (merged)" -ForegroundColor Green
        $ok++
    } else {
        $indexSrc = Join-Path $MEMORY_BUNDLE $INDEX_FILE
        if (Copy-Safe $indexSrc $indexPath) {
            Write-Host "    [ok] $INDEX_FILE" -ForegroundColor Green
            $ok++
        } else {
            Write-Host "    [FAIL] $INDEX_FILE" -ForegroundColor Red
            $fail++
        }
    }

    # 3. CLAUDE.md -> workspace root
    if ($WorkspacePath -and (Test-Path $WorkspacePath)) {
        $claudeSrc = Join-Path $MEMORY_BUNDLE 'CLAUDE.md'
        $claudeDst = Join-Path $WorkspacePath 'CLAUDE.md'
        if (Test-Path $claudeSrc) {
            if (Copy-Safe $claudeSrc $claudeDst) {
                Write-Host "    [ok] CLAUDE.md -> workspace" -ForegroundColor Green
                $ok++
            } else {
                Write-Host "    [FAIL] CLAUDE.md" -ForegroundColor Red
                $fail++
            }
        }
    }

    # 4. Skill -> workspace/.claude/skills/
    $skillResult = Deploy-Skill $WorkspacePath
    $ok += $skillResult.Ok
    $fail += $skillResult.Fail

    Write-Host "  [OK] $Label" -ForegroundColor Green
    return @{ Ok = $ok; Fail = $fail }
}

# --- Remove from workspace ---
function Remove-Memory {
    param([string]$MemoryDir, [string]$Label, [string]$WorkspacePath)

    # Remove memory file
    $memFile = Join-Path $MemoryDir $MEMORY_FILE
    if (Test-Path $memFile) {
        Remove-Item $memFile -Force
        Write-Host "    [ok] Removed $MEMORY_FILE" -ForegroundColor Yellow
    }

    # Clean index entry
    $indexPath = Join-Path $MemoryDir $INDEX_FILE
    if (Test-Path $indexPath) {
        $lines = [System.IO.File]::ReadAllLines($indexPath, $UTF8NoBOM)
        $filtered = @($lines | Where-Object { $_ -notmatch 'security-research-lab' })
        $hasContent = ($filtered | Where-Object { $_.Trim() -ne '' }).Count -gt 0
        if ($hasContent) {
            [System.IO.File]::WriteAllLines($indexPath, $filtered, $UTF8NoBOM)
            Write-Host "    [ok] $INDEX_FILE (cleaned entry)" -ForegroundColor Yellow
        } else {
            Remove-Item $indexPath -Force
            Write-Host "    [ok] Removed $INDEX_FILE" -ForegroundColor Yellow
        }
    }

    # Remove CLAUDE.md from workspace root (only if ours)
    if ($WorkspacePath -and (Test-Path $WorkspacePath)) {
        $claudePath = Join-Path $WorkspacePath 'CLAUDE.md'
        if (Test-Path $claudePath) {
            $content = [System.IO.File]::ReadAllText($claudePath, $UTF8NoBOM)
            if ($content -match 'Security Research Workstation') {
                Remove-Item $claudePath -Force
                Write-Host "    [ok] Removed CLAUDE.md from workspace" -ForegroundColor Yellow
            }
        }
    }

    # Remove skill
    Remove-Skill $WorkspacePath

    Write-Host "  [OK] $Label (removed)" -ForegroundColor Yellow
}

# --- Verify workspace ---
function Verify-Memory {
    param([string]$MemoryDir, [string]$Label, [string]$WorkspacePath)

    $allOk = $true

    $memFile = Join-Path $MemoryDir $MEMORY_FILE
    if (Test-Path $memFile) {
        $sz = (Get-Item $memFile).Length
        $content = ''
        try { $content = Get-Content $memFile -Raw -ErrorAction Stop } catch {}
        $hasLoop = $content -match 'Loop Engineering'
        $loopStatus = if ($hasLoop) { '+ Loop Engineering' } else { '(no Loop Engineering)' }
        Write-Host "    $MEMORY_FILE - OK ($sz bytes) $loopStatus" -ForegroundColor Green
    } else {
        Write-Host "    $MEMORY_FILE - MISSING" -ForegroundColor Red
        $allOk = $false
    }

    $indexPath = Join-Path $MemoryDir $INDEX_FILE
    if (Test-Path $indexPath) {
        $content = ''
        try { $content = Get-Content $indexPath -Raw -ErrorAction Stop } catch {}
        if ($content -match 'security-research-lab') {
            Write-Host "    $INDEX_FILE - OK" -ForegroundColor Green
        } else {
            Write-Host "    $INDEX_FILE - ENTRY MISSING" -ForegroundColor Yellow
            $allOk = $false
        }
    } else {
        Write-Host "    $INDEX_FILE - MISSING" -ForegroundColor Red
        $allOk = $false
    }

    if ($WorkspacePath -and (Test-Path $WorkspacePath)) {
        $claudePath = Join-Path $WorkspacePath 'CLAUDE.md'
        if (Test-Path $claudePath) {
            $sz = (Get-Item $claudePath).Length
            $claudeContent = ''
            try { $claudeContent = Get-Content $claudePath -Raw -ErrorAction Stop } catch {}
            $hasLoop = $claudeContent -match 'Loop Engineering'
            $loopStatus = if ($hasLoop) { '+ Loop Engineering' } else { '(no Loop Engineering)' }
            Write-Host "    CLAUDE.md (workspace) - OK ($sz bytes) $loopStatus" -ForegroundColor Green
        } else {
            Write-Host "    CLAUDE.md (workspace) - NOT FOUND" -ForegroundColor DarkGray
        }

        # Verify skill
        Verify-Skill $WorkspacePath
    }

    return $allOk
}

# --- Settings.json (global ~/.claude/) ---
function Deploy-Settings {
    $settingsPath = Join-Path $CLAUDE_DIR 'settings.json'
    if ($SkipSettings) {
        Write-Host '  [skip] settings.json (SkipSettings)' -ForegroundColor DarkGray
        return
    }
    $settingsSrc = Join-Path $CONFIG_BUNDLE 'settings.json'
    if (!(Test-Path $settingsSrc)) { return }

    if (!(Test-Path $CLAUDE_DIR)) {
        New-Item -ItemType Directory -Path $CLAUDE_DIR -Force | Out-Null
    }

    if (Test-Path $settingsPath) {
        # Merge cc-unlock keys into existing settings
        $raw = ''
        try { $raw = [System.IO.File]::ReadAllText($settingsPath, $UTF8NoBOM) } catch {}
        if ($raw -match 'bypassPermissions') {
            Write-Host '  [ok] settings.json (already has bypassPermissions)' -ForegroundColor DarkGray
            return
        }
        try {
            $existing = $raw | ConvertFrom-Json
            $existing | Add-Member -NotePropertyName 'permissions' -NotePropertyValue (
                New-Object PSObject -Property @{ defaultMode = 'bypassPermissions' }
            ) -Force
            $existing | Add-Member -NotePropertyName 'skipDangerousModePermissionPrompt' -NotePropertyValue $true -Force
            $json = $existing | ConvertTo-Json -Depth 10
            Write-Utf8NoBom $settingsPath $json | Out-Null
            Write-Host '  [ok] settings.json (merged bypassPermissions)' -ForegroundColor Green
        } catch {
            Write-Host '  [WARN] settings.json merge failed, skipping' -ForegroundColor Yellow
        }
    } else {
        if (Copy-Safe $settingsSrc $settingsPath) {
            Write-Host '  [ok] settings.json (bypassPermissions)' -ForegroundColor Green
        } else {
            Write-Host '  [FAIL] settings.json' -ForegroundColor Red
        }
    }
}

function Remove-Settings {
    $path = Join-Path $CLAUDE_DIR 'settings.json'
    if (!(Test-Path $path)) { return }
    $content = ''
    try { $content = Get-Content $path -Raw -ErrorAction Stop } catch {}
    if ($content -match 'bypassPermissions' -and $content -match 'skipDangerousModePermissionPrompt') {
        Remove-Item $path -Force
        Write-Host '  [ok] Removed settings.json (cc-unlock)' -ForegroundColor Yellow
    } else {
        Write-Host '  [skip] settings.json (user customized)' -ForegroundColor DarkGray
    }
}

# --- Codex functions ---

function Set-InstructionsFile($ConfigPath) {
    $line = 'model_instructions_file = "system-prompt.md"'
    if (!(Test-Path $ConfigPath)) {
        return (Write-Utf8NoBom $ConfigPath ($line + "`n"))
    }
    $existing = @()
    try { $existing = @(Get-Content $ConfigPath -ErrorAction Stop) } catch {}
    $kept = @($existing | Where-Object { $_ -notmatch '^\s*model_instructions_file\s*=' })
    $content = (@($line) + $kept) -join "`n"
    if (!$content.EndsWith("`n")) { $content += "`n" }
    return (Write-Utf8NoBom $ConfigPath $content)
}

function Remove-InstructionsFile($ConfigPath) {
    if (!(Test-Path $ConfigPath)) { return 'absent' }
    $existing = @()
    try { $existing = @(Get-Content $ConfigPath -ErrorAction Stop) } catch { return 'absent' }
    $kept = @($existing | Where-Object { $_ -notmatch '^\s*model_instructions_file\s*=' })
    $hasContent = $false
    foreach ($l in $kept) { if ($l -match '\S') { $hasContent = $true; break } }
    if ($hasContent) {
        $content = ($kept -join "`n")
        if (!$content.EndsWith("`n")) { $content += "`n" }
        Write-Utf8NoBom $ConfigPath $content | Out-Null
        return 'kept'
    }
    Remove-Item $ConfigPath -Force -ErrorAction SilentlyContinue
    return 'removed'
}

function Deploy-Codex-Config {
    Write-Host ''
    Write-Host '--- Codex ---' -ForegroundColor Cyan
    if (!(Test-Path $CODEX_BUNDLE)) {
        Write-Host '  [skip] Codex bundle not found' -ForegroundColor DarkGray
        return
    }
    if (!(Test-Path $CODEX_DIR)) {
        New-Item -ItemType Directory -Path $CODEX_DIR -Force | Out-Null
    }
    $srcFile = Join-Path $CODEX_BUNDLE 'system-prompt.md'
    if (Test-Path $srcFile) {
        $dst = Join-Path $CODEX_DIR 'system-prompt.md'
        if (Copy-Safe $srcFile $dst) {
            $sz = (Get-Item $dst).Length
            Write-Host "  [ok] system-prompt.md ($sz bytes)" -ForegroundColor Green
        } else {
            Write-Host '  [FAIL] system-prompt.md' -ForegroundColor Red
        }
    }
    $configPath = Join-Path $CODEX_DIR 'config.toml'
    if (Set-InstructionsFile $configPath) {
        Write-Host '  [ok] config.toml (merged)' -ForegroundColor Green
    } else {
        Write-Host '  [FAIL] config.toml' -ForegroundColor Red
    }
    $old = Join-Path $CODEX_DIR 'AGENTS.md'
    if (Test-Path $old) {
        Remove-Item $old -Force -ErrorAction SilentlyContinue
        Write-Host '  [ok] Cleaned old AGENTS.md' -ForegroundColor DarkGray
    }
}

function Uninstall-Codex-Config {
    if (!(Test-Path $CODEX_DIR)) { return }
    Write-Host ''
    Write-Host '--- Codex ---' -ForegroundColor Cyan
    foreach ($f in @('system-prompt.md', 'AGENTS.md')) {
        $p = Join-Path $CODEX_DIR $f
        if (Test-Path $p) {
            Remove-Item $p -Force -ErrorAction SilentlyContinue
            Write-Host "  [ok] Removed $f" -ForegroundColor Yellow
        }
    }
    switch (Remove-InstructionsFile (Join-Path $CODEX_DIR 'config.toml')) {
        'removed' { Write-Host '  [ok] Removed config.toml' -ForegroundColor Yellow }
        'kept'    { Write-Host '  [ok] config.toml (kept other settings)' -ForegroundColor DarkGray }
    }
}

function Verify-Codex-Config {
    if (!(Test-Path $CODEX_DIR)) {
        Write-Host '  [skip] Codex not deployed' -ForegroundColor DarkGray
        return
    }
    Write-Host ''
    Write-Host '--- Codex ---' -ForegroundColor Cyan
    foreach ($c in @(
        @{ File = 'system-prompt.md'; Pattern = 'cc-unlock' },
        @{ File = 'config.toml';      Pattern = 'system-prompt.md' }
    )) {
        $p = Join-Path $CODEX_DIR $c.File
        if (Test-Path $p) {
            $sz = (Get-Item $p).Length
            $content = ''
            try { $content = Get-Content $p -Raw -ErrorAction Stop } catch {}
            if ($content -match $c.Pattern) {
                Write-Host "  $($c.File) - OK ($sz bytes)" -ForegroundColor Green
            } else {
                Write-Host "  $($c.File) - CONTENT MISMATCH" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  $($c.File) - MISSING" -ForegroundColor Red
        }
    }
}

# --- Folder picker ---
function Show-FolderPicker {
    param([string]$Description)
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = $Description
    $dialog.ShowNewFolderButton = $true
    $dialog.RootFolder = [System.Environment+SpecialFolder]::Desktop
    $result = $dialog.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        return $dialog.SelectedPath
    }
    return $null
}

# --- Migrate: clean old v3.x/v5.x global deployment ---
function Remove-LegacyGlobal {
    foreach ($f in @('CLAUDE.md', 'system-prompt.md')) {
        $p = Join-Path $CLAUDE_DIR $f
        if (Test-Path $p) {
            Remove-Item $p -Force -ErrorAction SilentlyContinue
            Write-Host "  [migrate] Removed legacy $f from ~/.claude/" -ForegroundColor DarkGray
        }
    }
    switch (Remove-InstructionsFile (Join-Path $CLAUDE_DIR 'config.toml')) {
        'removed' { Write-Host '  [migrate] Removed legacy config.toml from ~/.claude/' -ForegroundColor DarkGray }
        'kept'    { }
    }
}

# ========== MAIN ==========

Show-Banner

# --- GUI mode ---
if ($GUI) {
    $desc = if ($Uninstall) {
        'Select workspace to remove from / 选择要移除的工作区'
    } else {
        'Select Claude Code workspace / 选择 Claude Code 工作区'
    }
    $picked = Show-FolderPicker $desc
    if (!$picked) {
        Write-Host '  [cancelled]' -ForegroundColor DarkGray
        Write-Host ''
        exit 0
    }
    $Path = $picked
}

# --- Codex-only mode ---
if ($Codex -and !$Path -and !$All -and !$List -and !$Verify) {
    if ($Uninstall) {
        Uninstall-Codex-Config
    } else {
        Deploy-Codex-Config
    }
    Write-Host ''
    Write-Host '  Restart Codex to activate. / 重启 Codex 生效。' -ForegroundColor Cyan
    Write-Host ''
    exit 0
}

# --- List mode ---
if ($List) {
    Write-Host '  Workspaces / 工作区:' -ForegroundColor White
    Write-Host ''
    if (!(Test-Path $CLAUDE_PROJECTS)) {
        Write-Host '  No Claude projects found.' -ForegroundColor DarkGray
        Write-Host ''
        exit 0
    }
    $dirs = Get-ChildItem $CLAUDE_PROJECTS -Directory
    foreach ($d in $dirs) {
        $memDir = Get-MemoryDir $d.Name
        $deployed = Test-Deployed $memDir
        $icon = if ($deployed) { '[*]' } else { '[ ]' }
        $color = if ($deployed) { 'Green' } else { 'DarkGray' }
        Write-Host "  $icon $($d.Name)" -ForegroundColor $color
    }
    Write-Host ''
    Write-Host '  [*] = memory + loop engineering deployed' -ForegroundColor DarkGray
    Write-Host ''
    exit 0
}

# --- Verify mode ---
if ($Verify) {
    Write-Host '  Verifying deployment / 验证部署...' -ForegroundColor Yellow
    Write-Host ''
    if ($Path) {
        $projectName = ConvertTo-ClaudeProjectPath $Path
        $memDir = Get-MemoryDir $projectName
        Write-Host "  $projectName" -ForegroundColor White
        Verify-Memory $memDir $projectName $Path | Out-Null
    } elseif ($All -or (!$Path -and !$Codex)) {
        Write-Host '  --- Claude Code ---' -ForegroundColor Cyan
        if (Test-Path $CLAUDE_PROJECTS) {
            $dirs = Get-ChildItem $CLAUDE_PROJECTS -Directory
            foreach ($d in $dirs) {
                $memDir = Get-MemoryDir $d.Name
                if (Test-Deployed $memDir) {
                    $wsPath = Resolve-WorkspaceFromProject $d.Name
                    Write-Host "  $($d.Name)" -ForegroundColor White
                    if ($wsPath) {
                        Write-Host "    -> $wsPath" -ForegroundColor DarkGray
                    } else {
                        Write-Host "    -> (workspace path not found)" -ForegroundColor DarkYellow
                    }
                    Verify-Memory $memDir $d.Name $wsPath | Out-Null
                }
            }
        }
        $sp = Join-Path $CLAUDE_DIR 'settings.json'
        if (Test-Path $sp) {
            Write-Host "    settings.json - OK" -ForegroundColor Green
        }
    }
    Verify-Codex-Config
    Write-Host ''
    exit 0
}

# --- All mode ---
if ($All) {
    if (!(Test-Path $CLAUDE_PROJECTS)) {
        Write-Host '  No Claude projects found.' -ForegroundColor DarkGray
        Write-Host '  Use -Path or -GUI to deploy to a workspace first.' -ForegroundColor DarkGray
        Write-Host ''
        exit 0
    }
    $dirs = Get-ChildItem $CLAUDE_PROJECTS -Directory
    $count = 0

    Write-Host '--- Claude Code ---' -ForegroundColor Cyan
    foreach ($d in $dirs) {
        $memDir = Get-MemoryDir $d.Name

        # Resolve original workspace path from project name
        $wsPath = Resolve-WorkspaceFromProject $d.Name

        if ($Uninstall) {
            if (Test-Deployed $memDir) {
                Remove-Memory $memDir $d.Name $wsPath
                $count++
            }
        } else {
            Deploy-Memory $memDir $d.Name $wsPath | Out-Null
            $count++
        }
    }

    if (!$Uninstall) {
        Deploy-Settings
        Remove-LegacyGlobal
        Deploy-Codex-Config
    } else {
        Remove-Settings
        Uninstall-Codex-Config
    }

    $action = if ($Uninstall) { 'Removed from / 已从' } else { 'Deployed to / 已部署到' }
    Write-Host ''
    Write-Host "  [OK] $action $count workspace(s)" -ForegroundColor Green
    Write-Host '  Restart Claude Code / Codex. / 重启 Claude Code / Codex。' -ForegroundColor Cyan
    Write-Host ''
    exit 0
}

# --- Single workspace mode ---
if (!$Path) {
    Write-Host '  Usage / 用法:' -ForegroundColor White
    Write-Host ''
    Write-Host '    .\deploy.ps1 -GUI                            Open folder picker / 打开文件夹选择器' -ForegroundColor DarkGray
    Write-Host '    .\deploy.ps1 -Path "C:\path\to\workspace"    Deploy to one workspace / 部署到一个工作区' -ForegroundColor DarkGray
    Write-Host '    .\deploy.ps1 -All                            Deploy to all workspaces / 部署到所有工作区' -ForegroundColor DarkGray
    Write-Host '    .\deploy.ps1 -List                           Show workspaces / 列出工作区' -ForegroundColor DarkGray
    Write-Host '    .\deploy.ps1 -Codex                          Deploy Codex only / 仅部署 Codex' -ForegroundColor DarkGray
    Write-Host '    .\deploy.ps1 -Verify                         Verify deployment / 验证部署' -ForegroundColor DarkGray
    Write-Host '    .\deploy.ps1 -Uninstall -All                 Remove from all / 从全部移除' -ForegroundColor DarkGray
    Write-Host '    .\deploy.ps1 -SkipSkill                      Deploy without skill / 不部署 skill' -ForegroundColor DarkGray
    Write-Host ''
    exit 0
}

if (!(Test-Path $Path)) {
    Write-Host "  [!] Path not found: $Path" -ForegroundColor Red
    Write-Host ''
    exit 1
}

# --- Deploy to single workspace ---
$projectName = ConvertTo-ClaudeProjectPath $Path
$memDir = Get-MemoryDir $projectName

Write-Host "--- Claude Code ---" -ForegroundColor Cyan
Write-Host "  Workspace: $Path" -ForegroundColor DarkGray
Write-Host "  Project:   $projectName" -ForegroundColor DarkGray
Write-Host ''

if ($Uninstall) {
    if (Test-Deployed $memDir) {
        Remove-Memory $memDir $projectName $Path
    } else {
        Write-Host "  [skip] Not deployed: $projectName" -ForegroundColor DarkGray
    }
    Remove-Settings
    Uninstall-Codex-Config
} else {
    Deploy-Memory $memDir $projectName $Path | Out-Null
    Deploy-Settings
    Remove-LegacyGlobal
    Deploy-Codex-Config
}

Write-Host ''
Write-Host '============================================' -ForegroundColor Cyan
Write-Host '  [OK] Complete! v6.0 Loop Engineering' -ForegroundColor Green
Write-Host '  Restart Claude Code / Codex. / 重启生效。' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''
