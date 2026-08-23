# cc-unlock v8.0.7 — 安全研究工作站
# 安全研究配置 + Loop Engineering 自递归改进引擎 + 多技能框架 → Claude Code + Codex
# Deploys cc-unlock research config + skills (android-reverse/web-reverse/win-reverse) + Loop Engineering
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
    [string]$Mode,
    [string]$RelayUrl,
    [string]$RelayKey,
    [string]$RelayModel
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
$CODEX_MEMORY_BUNDLE = Join-Path $SCRIPT_DIR '..\codex-files\codex-memory-bundle'
$CODEX_ROLLOUT_BUNDLE = Join-Path $SCRIPT_DIR '..\codex-files\codex-rollout-bundle\rollout_summaries'
$INDEX_FILE    = 'MEMORY.md'
$SKILL_DIRS    = @('loop-sec', 'android-reverse', 'web-reverse', 'win-reverse')

# --- Banner ---
function Show-Banner {
    Write-Host ''
    Write-Host '============================================' -ForegroundColor Cyan
    Write-Host '  cc-unlock v8.0.7 — Loop Engineering' -ForegroundColor Green
    Write-Host '  安全研究工作站' -ForegroundColor DarkGray
    Write-Host '  CVE exploit | keygen | VMP | OLLVM' -ForegroundColor DarkGray
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
    # cc-unlock sentinel: learner-profile.md. Legacy sentinels for migration.
    return ((Test-Path (Join-Path $MemoryDir 'learner-profile.md')) -or
            (Test-Path (Join-Path $MemoryDir 'engineer-profile.md')) -or
            (Test-Path (Join-Path $MemoryDir 'security-research-lab.md')))
}

# Enumerate every *.md in memory-bundle except MEMORY.md (the index; merged separately).
function Get-MemoryBundleFiles {
    if (!(Test-Path $MEMORY_BUNDLE)) { return @() }
    return @(Get-ChildItem $MEMORY_BUNDLE -Filter '*.md' -File |
             Where-Object { $_.Name -ne $INDEX_FILE -and $_.Name -ne 'CLAUDE.md' })
}

function Resolve-WorkspaceFromProject {
    param([string]$ProjectName)

    # Strategy 1: all dashes to backslashes (works for paths without spaces)
    $direct = ($ProjectName -replace '^([A-Za-z])-', '$1:\') -replace '-', '\'
    if ((Test-Path $direct -PathType Container)) { return $direct }

    # Strategy 2: recursive scan common parent dirs (depth 4), use forward conversion to match
    $scanRoots = @(
        (Join-Path $USER_HOME 'Desktop'),
        (Join-Path $USER_HOME 'Documents'),
        (Join-Path $USER_HOME 'Projects'),
        (Join-Path $USER_HOME 'source\repos'),
        (Join-Path $USER_HOME 'workspace'),
        $USER_HOME
    ) | Where-Object { Test-Path $_ -PathType Container }

    $maxDepth = 4
    $candidates = New-Object System.Collections.ArrayList

    foreach ($root in $scanRoots) {
        # Check root itself
        try {
            if ((ConvertTo-ClaudeProjectPath $root) -eq $ProjectName) {
                [void]$candidates.Add($root)
            }
        } catch {}

        # BFS to $maxDepth
        $queue = New-Object System.Collections.Queue
        [void]$queue.Enqueue(@{ Path = $root; Depth = 0 })
        while ($queue.Count -gt 0) {
            $item = $queue.Dequeue()
            if ($item.Depth -ge $maxDepth) { continue }
            $kids = @()
            try { $kids = @(Get-ChildItem $item.Path -Directory -Force -ErrorAction SilentlyContinue) } catch {}
            foreach ($kid in $kids) {
                try {
                    if ((ConvertTo-ClaudeProjectPath $kid.FullName) -eq $ProjectName) {
                        [void]$candidates.Add($kid.FullName)
                    }
                } catch {}
                [void]$queue.Enqueue(@{ Path = $kid.FullName; Depth = $item.Depth + 1 })
            }
        }
    }

    if ($candidates.Count -eq 0) { return $null }
    if ($candidates.Count -gt 1) {
        Write-Host "  [WARN] Multiple workspaces map to '$ProjectName':" -ForegroundColor Yellow
        foreach ($c in $candidates) { Write-Host "         $c" -ForegroundColor DarkYellow }
        Write-Host "         Skipping ambiguous project — use -Path to disambiguate." -ForegroundColor Yellow
        return $null
    }
    return $candidates[0]
}

# --- Deploy skills to workspace ---
function Deploy-Skill {
    param([string]$WorkspacePath)

    if ($SkipSkill) {
        Write-Host '  [skip] skills (SkipSkill)' -ForegroundColor DarkGray
        return @{ Ok = 0; Fail = 0 }
    }

    if (!$WorkspacePath -or !(Test-Path $WorkspacePath)) {
        return @{ Ok = 0; Fail = 0 }
    }

    $skillDir = Join-Path $WorkspacePath '.claude\skills'
    if (!(Test-Path $skillDir)) {
        New-Item -ItemType Directory -Path $skillDir -Force | Out-Null
    }

    $ok = 0; $fail = 0

    # Deploy all skill frameworks (loop-sec, android-reverse, web-reverse, win-reverse)
    foreach ($dir in $SKILL_DIRS) {
        $frameworkSrc = Join-Path $SKILL_BUNDLE $dir
        if (Test-Path $frameworkSrc) {
            $frameworkDst = Join-Path $skillDir $dir
            try {
                if (Test-Path $frameworkDst) { Remove-Item $frameworkDst -Recurse -Force -ErrorAction SilentlyContinue }
                Copy-Item $frameworkSrc $frameworkDst -Recurse -Force -ErrorAction Stop
                $fileCount = (Get-ChildItem $frameworkDst -Recurse -File).Count
                Write-Host "    [ok] skill/$dir/ ($fileCount files) -> .claude/skills/" -ForegroundColor Green
                $ok++
            } catch {
                Write-Host "    [FAIL] skill/$dir/" -ForegroundColor Red
                $fail++
            }
        }
    }

    return @{ Ok = $ok; Fail = $fail }
}

# --- Remove skills from workspace ---
function Remove-Skill {
    param([string]$WorkspacePath)

    if (!$WorkspacePath -or !(Test-Path $WorkspacePath)) { return }

    # Remove all skill frameworks
    foreach ($dir in $SKILL_DIRS) {
        $frameworkPath = Join-Path $WorkspacePath ".claude\skills\$dir"
        if (Test-Path $frameworkPath) {
            Remove-Item $frameworkPath -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "    [ok] Removed .claude/skills/$dir/" -ForegroundColor Yellow
        }
    }

    # Clean up empty skills dir
    $skillDir = Join-Path $WorkspacePath '.claude\skills'
    if ((Test-Path $skillDir) -and ((Get-ChildItem $skillDir).Count -eq 0)) {
        Remove-Item $skillDir -Force -ErrorAction SilentlyContinue
    }
}

# --- Verify skills ---
function Verify-Skill {
    param([string]$WorkspacePath)

    if (!$WorkspacePath -or !(Test-Path $WorkspacePath)) { return }

    # Verify all skill frameworks
    foreach ($dir in $SKILL_DIRS) {
        $frameworkPath = Join-Path $WorkspacePath ".claude\skills\$dir"
        if (Test-Path $frameworkPath) {
            $fileCount = (Get-ChildItem $frameworkPath -Recurse -File).Count
            Write-Host "    .claude/skills/$dir/ - OK ($fileCount files)" -ForegroundColor Green
        } else {
            Write-Host "    .claude/skills/$dir/ - NOT DEPLOYED" -ForegroundColor DarkGray
        }
    }
}

# --- Deploy to workspace (multi-file memory bundle) ---
function Deploy-Memory {
    param([string]$MemoryDir, [string]$Label, [string]$WorkspacePath)

    if (!(Test-Path $MemoryDir)) {
        New-Item -ItemType Directory -Path $MemoryDir -Force | Out-Null
    }

    $ok = 0; $fail = 0

    # 1. Deploy every *.md memory file from the bundle (except CLAUDE.md and MEMORY.md which are handled specially)
    $bundleFiles = Get-MemoryBundleFiles
    foreach ($f in $bundleFiles) {
        $dst = Join-Path $MemoryDir $f.Name
        if (Copy-Safe $f.FullName $dst) { $ok++ } else { Write-Host "    [FAIL] $($f.Name)" -ForegroundColor Red; $fail++ }
    }
    Write-Host "    [ok] $($bundleFiles.Count) memory files deployed" -ForegroundColor Green

    # 2. MEMORY.md index — always overwrite (cc-unlock owns the index; users who want their own should back up)
    $indexSrc = Join-Path $MEMORY_BUNDLE $INDEX_FILE
    $indexDst = Join-Path $MemoryDir $INDEX_FILE
    if (Test-Path $indexSrc) {
        if (Copy-Safe $indexSrc $indexDst) {
            Write-Host "    [ok] $INDEX_FILE (overwrote index)" -ForegroundColor Green
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

# --- Remove from workspace (multi-file memory bundle) ---
function Remove-Memory {
    param([string]$MemoryDir, [string]$Label, [string]$WorkspacePath)

    # Remove every memory md we own (whose filename matches a bundled file)
    # + the v6 legacy file security-research-lab.md if present
    $bundleFiles = Get-MemoryBundleFiles
    $ourNames = @($bundleFiles | ForEach-Object { $_.Name }) + @('security-research-lab.md')
    $removed = 0
    foreach ($name in $ourNames) {
        $p = Join-Path $MemoryDir $name
        if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue; $removed++ }
    }
    Write-Host "    [ok] Removed $removed memory files" -ForegroundColor Yellow

    # Remove MEMORY.md index (cc-unlock owns it)
    $indexPath = Join-Path $MemoryDir $INDEX_FILE
    if (Test-Path $indexPath) {
        Remove-Item $indexPath -Force -ErrorAction SilentlyContinue
        Write-Host "    [ok] Removed $INDEX_FILE" -ForegroundColor Yellow
    }

    # Remove CLAUDE.md from workspace root (cc-unlock owns it — see README warning)
    if ($WorkspacePath -and (Test-Path $WorkspacePath)) {
        $claudePath = Join-Path $WorkspacePath 'CLAUDE.md'
        if (Test-Path $claudePath) {
            Remove-Item $claudePath -Force -ErrorAction SilentlyContinue
            Write-Host "    [ok] Removed CLAUDE.md from workspace" -ForegroundColor Yellow
        }
    }

    # Remove skill
    Remove-Skill $WorkspacePath

    Write-Host "  [OK] $Label (removed)" -ForegroundColor Yellow
}

# --- Verify workspace (multi-file memory bundle) ---
function Verify-Memory {
    param([string]$MemoryDir, [string]$Label, [string]$WorkspacePath)

    $allOk = $true
    $bundleFiles = Get-MemoryBundleFiles
    $deployed = 0
    foreach ($f in $bundleFiles) {
        if (Test-Path (Join-Path $MemoryDir $f.Name)) { $deployed++ }
    }
    $expected = $bundleFiles.Count
    if ($expected -eq 0) {
        Write-Host "    memory files - ERROR (empty bundle in payload)" -ForegroundColor Red
        $allOk = $false
    } elseif ($deployed -eq $expected) {
        Write-Host "    memory files - OK ($deployed/$expected)" -ForegroundColor Green
    } else {
        Write-Host "    memory files - PARTIAL ($deployed/$expected)" -ForegroundColor Yellow
        $allOk = $false
    }

    $indexPath = Join-Path $MemoryDir $INDEX_FILE
    if (Test-Path $indexPath) {
        $content = ''
        try { $content = Get-Content $indexPath -Raw -ErrorAction Stop } catch {}
        if ($content -match 'engineer-profile|three-modes-framework') {
            Write-Host "    $INDEX_FILE - OK" -ForegroundColor Green
        } else {
            Write-Host "    $INDEX_FILE - PRESENT" -ForegroundColor Green
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
#
# 部署策略：合并式写入 —— 只塞我们的键 (permissions.defaultMode / skipDangerousModePermissionPrompt /
#           effortLevel / env)，其他用户已有键(hooks / allow / deny / model / …)全部保留。
# 卸载策略：精准删除 —— 只删我们塞的键；如果用户加了自己的键,保留文件;只有当文件仅剩空对象时才整删。

$SETTINGS_KEYS_ENV = @('CLAUDE_CODE_EFFORT_LEVEL', 'DISABLE_AUTOUPDATER')

function Deploy-Settings {
    if ($SkipSettings) {
        Write-Host '  [skip] settings.json (SkipSettings)' -ForegroundColor DarkGray
        return
    }
    $settingsPath = Join-Path $CLAUDE_DIR 'settings.json'
    $settingsSrc = Join-Path $CONFIG_BUNDLE 'settings.json'
    if (!(Test-Path $settingsSrc)) { return }

    if (!(Test-Path $CLAUDE_DIR)) {
        New-Item -ItemType Directory -Path $CLAUDE_DIR -Force | Out-Null
    }

    # Load our source settings so we know exactly what to inject
    $srcSettings = $null
    try { $srcSettings = (Get-Content $settingsSrc -Raw -ErrorAction Stop) | ConvertFrom-Json } catch {
        Write-Host '  [WARN] source settings.json malformed, skipping' -ForegroundColor Yellow
        return
    }

    # If no existing file: write ours verbatim
    if (!(Test-Path $settingsPath)) {
        if (Copy-Safe $settingsSrc $settingsPath) {
            Write-Host '  [ok] settings.json (bypassPermissions)' -ForegroundColor Green
        } else {
            Write-Host '  [FAIL] settings.json' -ForegroundColor Red
        }
        return
    }

    # Merge into user's existing settings.json
    $existing = $null
    try {
        $raw = [System.IO.File]::ReadAllText($settingsPath, $UTF8NoBOM)
        if ($raw.Trim()) { $existing = $raw | ConvertFrom-Json }
    } catch {
        Write-Host '  [WARN] existing settings.json malformed, leaving untouched' -ForegroundColor Yellow
        return
    }
    if (!$existing) { $existing = New-Object PSObject }

    # Merge permissions.defaultMode WITHOUT clobbering user's allow/deny/additionalDirectories
    $userPerms = $existing.permissions
    if ($userPerms -and ($userPerms.PSObject.Properties.Name -contains 'defaultMode') -and $userPerms.defaultMode -eq 'bypassPermissions') {
        # already ours; leave as is
    } elseif ($userPerms) {
        $userPerms | Add-Member -NotePropertyName 'defaultMode' -NotePropertyValue 'bypassPermissions' -Force
    } else {
        $existing | Add-Member -NotePropertyName 'permissions' -NotePropertyValue (
            New-Object PSObject -Property @{ defaultMode = 'bypassPermissions' }
        ) -Force
    }

    # skipDangerousModePermissionPrompt
    $existing | Add-Member -NotePropertyName 'skipDangerousModePermissionPrompt' -NotePropertyValue $true -Force

    # effortLevel (only if not set by user)
    if (!($existing.PSObject.Properties.Name -contains 'effortLevel')) {
        $srcEffort = if ($srcSettings.PSObject.Properties.Name -contains 'effortLevel') { $srcSettings.effortLevel } else { 'xhigh' }
        $existing | Add-Member -NotePropertyName 'effortLevel' -NotePropertyValue $srcEffort -Force
    }

    # env: deep-merge only the two keys we care about
    $userEnv = $existing.env
    if (!$userEnv) {
        $userEnv = New-Object PSObject
        $existing | Add-Member -NotePropertyName 'env' -NotePropertyValue $userEnv -Force
    }
    if ($srcSettings.env) {
        foreach ($k in $SETTINGS_KEYS_ENV) {
            if ($srcSettings.env.PSObject.Properties.Name -contains $k -and !($userEnv.PSObject.Properties.Name -contains $k)) {
                $userEnv | Add-Member -NotePropertyName $k -NotePropertyValue $srcSettings.env.$k -Force
            }
        }
    }

    $json = $existing | ConvertTo-Json -Depth 10
    if (Write-Utf8NoBom $settingsPath $json) {
        Write-Host '  [ok] settings.json (merged bypassPermissions + effortLevel + env)' -ForegroundColor Green
    } else {
        Write-Host '  [FAIL] settings.json' -ForegroundColor Red
    }
}

function Remove-Settings {
    $path = Join-Path $CLAUDE_DIR 'settings.json'
    if (!(Test-Path $path)) { return }
    $existing = $null
    try {
        $raw = [System.IO.File]::ReadAllText($path, $UTF8NoBOM)
        if ($raw.Trim()) { $existing = $raw | ConvertFrom-Json }
    } catch {
        Write-Host '  [skip] settings.json (unreadable / not JSON)' -ForegroundColor DarkGray
        return
    }
    if (!$existing) {
        Remove-Item $path -Force -ErrorAction SilentlyContinue
        Write-Host '  [ok] Removed empty settings.json' -ForegroundColor Yellow
        return
    }

    $touched = $false

    # permissions.defaultMode: only remove if it's ours (bypassPermissions), keep user's other permission sub-keys
    if ($existing.permissions -and ($existing.permissions.PSObject.Properties.Name -contains 'defaultMode') -and $existing.permissions.defaultMode -eq 'bypassPermissions') {
        $existing.permissions.PSObject.Properties.Remove('defaultMode')
        $touched = $true
        # If permissions is now empty, drop the whole property
        if ($existing.permissions.PSObject.Properties.Name.Count -eq 0) {
            $existing.PSObject.Properties.Remove('permissions')
        }
    }

    # skipDangerousModePermissionPrompt (only touch when it's the bool we injected)
    if ($existing.PSObject.Properties.Name -contains 'skipDangerousModePermissionPrompt') {
        $existing.PSObject.Properties.Remove('skipDangerousModePermissionPrompt')
        $touched = $true
    }

    # effortLevel: only remove if it's the xhigh we set (leave alone if user changed it)
    if ($existing.PSObject.Properties.Name -contains 'effortLevel' -and $existing.effortLevel -eq 'xhigh') {
        $existing.PSObject.Properties.Remove('effortLevel')
        $touched = $true
    }

    # env: remove only our two keys, keep user-added envs
    if ($existing.env) {
        foreach ($k in $SETTINGS_KEYS_ENV) {
            if ($existing.env.PSObject.Properties.Name -contains $k) {
                $existing.env.PSObject.Properties.Remove($k)
                $touched = $true
            }
        }
        if ($existing.env.PSObject.Properties.Name.Count -eq 0) {
            $existing.PSObject.Properties.Remove('env')
        }
    }

    if (!$touched) {
        Write-Host '  [skip] settings.json (no cc-unlock keys found)' -ForegroundColor DarkGray
        return
    }

    if ($existing.PSObject.Properties.Name.Count -eq 0) {
        Remove-Item $path -Force -ErrorAction SilentlyContinue
        Write-Host '  [ok] Removed settings.json (was cc-unlock only)' -ForegroundColor Yellow
    } else {
        $json = $existing | ConvertTo-Json -Depth 10
        if (Write-Utf8NoBom $path $json) {
            Write-Host '  [ok] settings.json (stripped cc-unlock keys, kept user keys)' -ForegroundColor Yellow
        } else {
            Write-Host '  [WARN] settings.json write failed on strip' -ForegroundColor Yellow
        }
    }
}

# --- Codex functions ---

# Latin-1 (ISO 8859-1) byte passthrough for config.toml manipulation.
# Latin-1 is a 1-to-1 mapping: every byte 0x00-0xFF maps to the same
# Unicode code point. This means:
#   - Non-ASCII bytes (CJK in GBK, UTF-8, or any encoding) pass through
#     as-is without interpretation — they are NEVER decoded as text.
#   - Our key (model_instructions_file) is pure ASCII, so regex matches
#     work correctly on it without touching non-ASCII content.
#   - Writing back via Latin-1 produces the exact same bytes — zero
#     encoding corruption regardless of the file's actual encoding.
# This replaces the old UTF-8-strict-then-GBK-fallback approach, which
# failed when corruption had already produced "valid UTF-8 garbage" that
# passed the strict check.
$LATIN1 = [System.Text.Encoding]::GetEncoding(28591)

function Set-InstructionsFile($ConfigPath) {
    $line = 'model_instructions_file = "system-prompt.md"'
    if (!(Test-Path $ConfigPath)) {
        return (Write-Utf8NoBom $ConfigPath ($line + "`n"))
    }
    $raw = [System.IO.File]::ReadAllBytes($ConfigPath)
    $text = $LATIN1.GetString($raw)
    if ($text -match '(?m)^model_instructions_file\s*=\s*"system-prompt\.md"') { return $true }
    $lines = $text -split "`r?`n"
    $kept = @($lines | Where-Object { $_ -notmatch '^\s*model_instructions_file\s*=' })
    $content = $line + "`n" + ($kept -join "`n")
    if (!$content.EndsWith("`n")) { $content += "`n" }
    [System.IO.File]::WriteAllBytes($ConfigPath, $LATIN1.GetBytes($content))
    return $true
}

function Remove-InstructionsFile($ConfigPath) {
    if (!(Test-Path $ConfigPath)) { return 'absent' }
    $raw = [System.IO.File]::ReadAllBytes($ConfigPath)
    $text = $LATIN1.GetString($raw)
    $lines = $text -split "`r?`n"
    $kept = @($lines | Where-Object { $_ -notmatch '^\s*model_instructions_file\s*=' })
    $hasContent = $false
    foreach ($l in $kept) { if ($l -match '\S') { $hasContent = $true; break } }
    if ($hasContent) {
        $content = ($kept -join "`n")
        if (!$content.EndsWith("`n")) { $content += "`n" }
        [System.IO.File]::WriteAllBytes($ConfigPath, $LATIN1.GetBytes($content))
        return 'kept'
    }
    Remove-Item $ConfigPath -Force -ErrorAction SilentlyContinue
    return 'removed'
}

function Deploy-RelayProvider($ConfigPath, $ApiUrl, $ApiKey, $Model) {
    if (!(Test-Path $ConfigPath)) { return }
    $raw = [System.IO.File]::ReadAllBytes($ConfigPath)
    $text = $LATIN1.GetString($raw)
    $lines = $text -split "`r?`n"
    $kept = [System.Collections.ArrayList]::new()
    $skip = $false
    foreach ($l in $lines) {
        if ($l -match '^\[model_providers\.cc_unlock_relay\]') { $skip = $true; continue }
        if ($skip -and $l -match '^\[') { $skip = $false }
        if (!$skip) { [void]$kept.Add($l) }
    }
    $block = @(
        ''
        '[model_providers.cc_unlock_relay]'
        "name = `"cc-unlock Relay`""
        "base_url = `"$ApiUrl`""
        'wire_api = "responses"'
        'requires_openai_auth = false'
    )
    if ($ApiKey) { $block += "api_key = `"$ApiKey`"" }
    if ($Model) { $block += "model = `"$Model`"" }
    $content = ($kept -join "`n") + ($block -join "`n") + "`n"
    [System.IO.File]::WriteAllBytes($ConfigPath, $LATIN1.GetBytes($content))
}

function Remove-RelayProvider($ConfigPath) {
    if (!(Test-Path $ConfigPath)) { return }
    $raw = [System.IO.File]::ReadAllBytes($ConfigPath)
    $text = $LATIN1.GetString($raw)
    if ($text -notmatch '\[model_providers\.cc_unlock_relay\]') { return }
    $lines = $text -split "`r?`n"
    $kept = [System.Collections.ArrayList]::new()
    $skip = $false
    foreach ($l in $lines) {
        if ($l -match '^\[model_providers\.cc_unlock_relay\]') { $skip = $true; continue }
        if ($skip -and $l -match '^\[') { $skip = $false }
        if (!$skip) { [void]$kept.Add($l) }
    }
    $content = ($kept -join "`n")
    if (!$content.EndsWith("`n")) { $content += "`n" }
    [System.IO.File]::WriteAllBytes($ConfigPath, $LATIN1.GetBytes($content))
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
    if ($RelayUrl) {
        Deploy-RelayProvider $configPath $RelayUrl $RelayKey $RelayModel
        Write-Host "  [ok] Relay provider: $RelayUrl" -ForegroundColor Green
    }
    $old = Join-Path $CODEX_DIR 'AGENTS.md'
    if (Test-Path $old) {
        Remove-Item $old -Force -ErrorAction SilentlyContinue
        Write-Host '  [ok] Cleaned old AGENTS.md' -ForegroundColor DarkGray
    }
    Deploy-Codex-Skills
    Deploy-Codex-Memory
}

function Deploy-Codex-Skills {
    Write-Host ''
    Write-Host '--- Codex Skills ---' -ForegroundColor Cyan
    $codexSkillDir = Join-Path $CODEX_DIR 'skills'
    if (!(Test-Path $codexSkillDir)) {
        New-Item -ItemType Directory -Path $codexSkillDir -Force | Out-Null
    }
    # Deploy all skill frameworks (loop-sec, android-reverse, web-reverse, win-reverse)
    foreach ($dir in $SKILL_DIRS) {
        $frameworkSrc = Join-Path $SKILL_BUNDLE $dir
        if (Test-Path $frameworkSrc) {
            $frameworkDst = Join-Path $codexSkillDir $dir
            try {
                if (Test-Path $frameworkDst) { Remove-Item $frameworkDst -Recurse -Force -ErrorAction SilentlyContinue }
                Copy-Item $frameworkSrc $frameworkDst -Recurse -Force -ErrorAction Stop
                $fileCount = (Get-ChildItem $frameworkDst -Recurse -File).Count
                Write-Host "  [ok] $dir/ ($fileCount files) -> .codex/skills/" -ForegroundColor Green
            } catch {
                Write-Host "  [FAIL] $dir/" -ForegroundColor Red
            }
        }
    }
}

function Deploy-Codex-Memory {
    Write-Host ''
    Write-Host '--- Codex Memory ---' -ForegroundColor Cyan
    if (Test-Path $CODEX_MEMORY_BUNDLE) {
        $memDir = Join-Path $CODEX_DIR 'memories'
        if (!(Test-Path $memDir)) {
            New-Item -ItemType Directory -Path $memDir -Force | Out-Null
        }
        foreach ($f in @('memory_summary.md', 'MEMORY.md', 'raw_memories.md')) {
            $src = Join-Path $CODEX_MEMORY_BUNDLE $f
            if (Test-Path $src) {
                $dst = Join-Path $memDir $f
                if (Copy-Safe $src $dst) {
                    $sz = (Get-Item $dst).Length
                    Write-Host "  [ok] $f ($sz bytes)" -ForegroundColor Green
                } else {
                    Write-Host "  [FAIL] $f" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host '  [skip] Codex memory bundle not found' -ForegroundColor DarkGray
    }
    # Rollout seeding runs independently — never gated on memory bundle presence
    Deploy-Codex-Rollout
}

function Deploy-Codex-Rollout {
    Write-Host ''
    Write-Host '--- Codex Rollout Summaries ---' -ForegroundColor Cyan
    if (!(Test-Path $CODEX_ROLLOUT_BUNDLE)) {
        Write-Host '  [skip] Codex rollout bundle not found' -ForegroundColor DarkGray
        return
    }
    # Enumerate source first — refuse to wipe target when source is empty (guard against accidental data loss)
    $srcFiles = @(Get-ChildItem $CODEX_ROLLOUT_BUNDLE -Filter '*.md' -File)
    if ($srcFiles.Count -eq 0) {
        Write-Host '  [skip] Codex rollout bundle contains no *.md — refusing to wipe target' -ForegroundColor Yellow
        return
    }
    $rolloutDir = Join-Path $CODEX_DIR 'memories\rollout_summaries'
    if (!(Test-Path $rolloutDir)) {
        New-Item -ItemType Directory -Path $rolloutDir -Force | Out-Null
    } else {
        # Overwrite mode: wipe existing rollout summaries so seeded set replaces refusal history
        Get-ChildItem $rolloutDir -Filter '*.md' -File | Remove-Item -Force -ErrorAction SilentlyContinue
    }
    $currentUser = if ($env:USERNAME) { $env:USERNAME } else { 'user' }
    $count = 0
    foreach ($f in $srcFiles) {
        $content = $null
        try { $content = [System.IO.File]::ReadAllText($f.FullName, $UTF8NoBOM) } catch { continue }
        if (!$content) { continue }
        # Literal string replace (NOT regex -replace) so usernames containing $, ., \ etc. don't corrupt the payload
        $content = $content.Replace('<USER>', $currentUser)
        $dst = Join-Path $rolloutDir $f.Name
        if (Write-Utf8NoBom $dst $content) { $count++ }
    }
    if ($count -gt 0) {
        Write-Host "  [ok] $count rollout summaries seeded (USERNAME=$currentUser)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] 0 rollout summaries seeded — check read/write permissions" -ForegroundColor Red
    }
}

function Uninstall-Codex-Memory {
    $memDir = Join-Path $CODEX_DIR 'memories'
    if (!(Test-Path $memDir)) { return }
    Write-Host ''
    Write-Host '--- Codex Memory ---' -ForegroundColor Cyan
    foreach ($f in @('memory_summary.md', 'MEMORY.md', 'raw_memories.md')) {
        $p = Join-Path $memDir $f
        if (Test-Path $p) {
            Remove-Item $p -Force -ErrorAction SilentlyContinue
            Write-Host "  [ok] Removed $f" -ForegroundColor Yellow
        }
    }
    Uninstall-Codex-Rollout
}

function Uninstall-Codex-Rollout {
    $rolloutDir = Join-Path $CODEX_DIR 'memories\rollout_summaries'
    if (!(Test-Path $rolloutDir)) { return }
    Write-Host ''
    Write-Host '--- Codex Rollout Summaries ---' -ForegroundColor Cyan
    # Only remove files that carry the seeded marker (cwd path prefix `\\?\C:\Workspace\`)
    $removed = 0
    Get-ChildItem $rolloutDir -Filter '*.md' -File | ForEach-Object {
        $content = ''
        try { $content = [System.IO.File]::ReadAllText($_.FullName, $UTF8NoBOM) } catch {}
        if ($content -match 'cwd:\s*\\\\\?\\C:\\Workspace\\') {
            Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
            $removed++
        }
    }
    Write-Host "  [ok] Removed $removed seeded rollout summaries" -ForegroundColor Yellow
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
    $cfgPath = Join-Path $CODEX_DIR 'config.toml'
    Remove-RelayProvider $cfgPath
    switch (Remove-InstructionsFile $cfgPath) {
        'removed' { Write-Host '  [ok] Removed config.toml' -ForegroundColor Yellow }
        'kept'    { Write-Host '  [ok] config.toml (kept other settings)' -ForegroundColor DarkGray }
    }
    Uninstall-Codex-Skills
    Uninstall-Codex-Memory
}

function Uninstall-Codex-Skills {
    $codexSkillDir = Join-Path $CODEX_DIR 'skills'
    if (!(Test-Path $codexSkillDir)) { return }
    foreach ($dir in $SKILL_DIRS) {
        $frameworkPath = Join-Path $codexSkillDir $dir
        if (Test-Path $frameworkPath) {
            Remove-Item $frameworkPath -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "  [ok] Removed .codex/skills/$dir/" -ForegroundColor Yellow
        }
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
        @{ File = 'system-prompt.md'; Pattern = 'Loop Engineering|security research' },
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
    Verify-Codex-Memory
}

function Verify-Codex-Memory {
    $memDir = Join-Path $CODEX_DIR 'memories'
    if (!(Test-Path $memDir)) {
        Write-Host '  [skip] Codex memory not deployed' -ForegroundColor DarkGray
        return
    }
    Write-Host ''
    Write-Host '--- Codex Memory ---' -ForegroundColor Cyan
    foreach ($c in @(
        @{ File = 'memory_summary.md'; Pattern = 'security researcher|technical sidekick' },
        @{ File = 'MEMORY.md';         Pattern = 'researcher|lab-semantic' },
        @{ File = 'raw_memories.md';   Pattern = 'researcher-context|delivery-track-record' }
    )) {
        $p = Join-Path $memDir $c.File
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
# Unconditional cleanup — cc-unlock owns ~/.claude/CLAUDE.md and system-prompt.md at deploy time.
# Users who want their own global CLAUDE.md should back it up before installing.
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
Write-Host '  [OK] Complete! cc-unlock v8.0.7 Loop Engineering' -ForegroundColor Green
Write-Host '  Restart Claude Code / Codex. / 重启生效。' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''
