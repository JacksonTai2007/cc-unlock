# cc-unlock v5.0 GUI - PowerShell WinForms
# Sidebar navigation + version detection + i18n (zh/en)

param([switch]$NoConsole)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { chcp 65001 | Out-Null } catch {}

$UTF8NoBOM = New-Object System.Text.UTF8Encoding $false

# === Paths ===
$USER_HOME = $env:USERPROFILE
if (!$USER_HOME) { $USER_HOME = [Environment]::GetFolderPath('UserProfile') }
$CLAUDE_DIR      = Join-Path $USER_HOME '.claude'
$CLAUDE_PROJECTS = Join-Path $CLAUDE_DIR 'projects'
$CODEX_DIR       = Join-Path $USER_HOME '.codex'

$SCRIPT_DIR = $PSScriptRoot
if (!$SCRIPT_DIR) {
    try { $SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path } catch {}
    if (!$SCRIPT_DIR) { $SCRIPT_DIR = (Get-Location).Path }
}

$CC_FILES     = Join-Path $SCRIPT_DIR 'cc-unlock-files'
$MEM_BUNDLE   = Join-Path $CC_FILES 'memory-bundle'
$CFG_BUNDLE   = Join-Path $CC_FILES 'config-bundle'
$SKILL_BUNDLE = Join-Path $CC_FILES 'skill-bundle'
$CODEX_BUNDLE = Join-Path $SCRIPT_DIR 'codex-files\codex-config-bundle'

# === Colors (Catppuccin Mocha) ===
$CLR_BG         = [System.Drawing.Color]::FromArgb(30, 30, 46)
$CLR_SIDEBAR    = [System.Drawing.Color]::FromArgb(24, 24, 37)
$CLR_SURFACE    = [System.Drawing.Color]::FromArgb(45, 45, 65)
$CLR_BORDER     = [System.Drawing.Color]::FromArgb(70, 70, 100)
$CLR_TEXT       = [System.Drawing.Color]::FromArgb(205, 214, 244)
$CLR_SUBTEXT    = [System.Drawing.Color]::FromArgb(147, 153, 178)
$CLR_GREEN      = [System.Drawing.Color]::FromArgb(166, 227, 161)
$CLR_RED        = [System.Drawing.Color]::FromArgb(243, 139, 168)
$CLR_YELLOW     = [System.Drawing.Color]::FromArgb(249, 226, 175)
$CLR_BLUE       = [System.Drawing.Color]::FromArgb(137, 180, 250)
$CLR_MAUVE      = [System.Drawing.Color]::FromArgb(203, 166, 247)
$CLR_TEAL       = [System.Drawing.Color]::FromArgb(148, 226, 213)
$CLR_NAV_ACTIVE = [System.Drawing.Color]::FromArgb(40, 40, 58)
$CLR_NAV_HOVER  = [System.Drawing.Color]::FromArgb(35, 35, 50)
$CLR_BTN        = [System.Drawing.Color]::FromArgb(55, 55, 80)
$CLR_BTN_GREEN  = [System.Drawing.Color]::FromArgb(30, 100, 60)
$CLR_BTN_RED    = [System.Drawing.Color]::FromArgb(100, 40, 40)

# === Fonts ===
$fontFamily = 'Microsoft YaHei UI'
try { $tf = New-Object System.Drawing.Font($fontFamily, 10); $tf.Dispose() } catch { $fontFamily = 'Segoe UI' }
$fNavTitle  = New-Object System.Drawing.Font($fontFamily, 14, [System.Drawing.FontStyle]::Bold)
$fNavSub    = New-Object System.Drawing.Font($fontFamily, 9)
$fNav       = New-Object System.Drawing.Font($fontFamily, 10)
$fSection   = New-Object System.Drawing.Font($fontFamily, 8.5, [System.Drawing.FontStyle]::Bold)
$fPageTitle = New-Object System.Drawing.Font($fontFamily, 13, [System.Drawing.FontStyle]::Bold)
$fBody      = New-Object System.Drawing.Font($fontFamily, 9.5)
$fBodyBold  = New-Object System.Drawing.Font($fontFamily, 9.5, [System.Drawing.FontStyle]::Bold)
$fMono      = New-Object System.Drawing.Font('Consolas', 9)
$fBtn       = New-Object System.Drawing.Font($fontFamily, 9, [System.Drawing.FontStyle]::Bold)

# === i18n ===
$script:lang = 'zh'
$script:S = @{
    nav_overview  = @{ zh = '  概览';    en = '  Overview' }
    nav_deploy    = @{ zh = '  部署';    en = '  Deploy' }
    nav_settings  = @{ zh = '  设置';    en = '  Settings' }
    nav_about     = @{ zh = '  关于';    en = '  About' }
    sec_env       = @{ zh = '环境检测';   en = 'ENVIRONMENT' }
    sec_bundle    = @{ zh = 'BUNDLE 状态'; en = 'BUNDLE STATUS' }
    sec_ws_sum    = @{ zh = '工作区概览';  en = 'WORKSPACE SUMMARY' }
    ov_cc_ver     = @{ zh = 'Claude Code 版本'; en = 'Claude Code Version' }
    ov_codex_ver  = @{ zh = 'Codex 版本';      en = 'Codex Version' }
    ov_installed  = @{ zh = '已安装';    en = 'Installed' }
    ov_not_found  = @{ zh = '未检测到';   en = 'Not Detected' }
    ov_cfg_found  = @{ zh = '配置存在';   en = 'Config Found' }
    ov_ready      = @{ zh = '已就绪';    en = 'Ready' }
    ov_missing    = @{ zh = '缺失';     en = 'Missing' }
    ov_deployed   = @{ zh = '已部署工作区'; en = 'Deployed Workspaces' }
    ov_loop_cnt   = @{ zh = 'Loop Engine 启用'; en = 'Loop Engine Active' }
    dp_title      = @{ zh = '部署管理';   en = 'Deploy Management' }
    dp_ws         = @{ zh = '工作区';    en = 'Workspace' }
    dp_status     = @{ zh = '状态';     en = 'Status' }
    dp_loop       = @{ zh = 'Loop Engine'; en = 'Loop Engine' }
    dp_custom     = @{ zh = '自定义路径:'; en = 'Custom path:' }
    dp_browse     = @{ zh = '浏览...';   en = 'Browse...' }
    dp_options    = @{ zh = '选项';     en = 'OPTIONS' }
    dp_opt_set    = @{ zh = '部署 settings.json (bypassPermissions)'; en = 'Deploy settings.json (bypassPermissions)' }
    dp_opt_skill  = @{ zh = '部署技能 (loop-sec.md)'; en = 'Deploy skill (loop-sec.md)' }
    dp_opt_codex  = @{ zh = '部署 Codex 配置'; en = 'Deploy Codex config' }
    dp_deploy_sel = @{ zh = '部署选中';   en = 'Deploy Selected' }
    dp_deploy_all = @{ zh = '全部部署';   en = 'Deploy All' }
    dp_uninst_sel = @{ zh = '卸载选中';   en = 'Uninstall Selected' }
    dp_uninst_all = @{ zh = '全部卸载';   en = 'Uninstall All' }
    dp_verify     = @{ zh = '验证';     en = 'Verify' }
    dp_refresh    = @{ zh = '刷新';     en = 'Refresh' }
    dp_log        = @{ zh = '日志';     en = 'LOG' }
    dp_deployed   = @{ zh = '已部署';    en = 'Deployed' }
    dp_not_dep    = @{ zh = '未部署';    en = 'Not deployed' }
    dp_active     = @{ zh = '启用';     en = 'Active' }
    dp_no_sel     = @{ zh = '未选择工作区。请勾选列表项或输入路径。'; en = 'No workspace selected. Check items or enter a path.' }
    dp_done       = @{ zh = '完成。请重启 Claude Code / Codex。'; en = 'Done. Restart Claude Code / Codex.' }
    dp_refreshed  = @{ zh = '工作区列表已刷新。'; en = 'Workspace list refreshed.' }
    dp_sel_folder = @{ zh = '选择工作区目录'; en = 'Select workspace directory' }
    st_title      = @{ zh = '设置';     en = 'Settings' }
    st_lang       = @{ zh = '界面语言';   en = 'INTERFACE LANGUAGE' }
    st_paths      = @{ zh = '路径信息';   en = 'PATH INFORMATION' }
    st_bundle     = @{ zh = 'Bundle 路径'; en = 'Bundle Path' }
    st_cc_dir     = @{ zh = 'Claude Code 配置'; en = 'Claude Code Config' }
    st_codex_dir  = @{ zh = 'Codex 配置';      en = 'Codex Config' }
    ab_section    = @{ zh = 'ABOUT';   en = 'ABOUT' }
    ab_title      = @{ zh = '关于 cc-unlock'; en = 'About cc-unlock' }
    ab_version    = @{ zh = 'cc-unlock 版本'; en = 'cc-unlock Version' }
    ab_desc_title = @{ zh = '描述';     en = 'DESCRIPTION' }
    ab_desc       = @{ zh = 'Loop Engineering 自递归任务执行引擎 + 安全研究授权上下文自动部署工具'; en = 'Loop Engineering self-recursive task engine + security research authorization auto-deployer' }
    ab_feat_title = @{ zh = '功能';     en = 'FEATURES' }
    ab_feat1      = @{ zh = '- 记忆注入 (security-research-lab.md)'; en = '- Memory injection (security-research-lab.md)' }
    ab_feat2      = @{ zh = '- CLAUDE.md 策略对齐 + 反拒答协议'; en = '- CLAUDE.md policy alignment + anti-refusal protocol' }
    ab_feat3      = @{ zh = '- Loop Engineering 技能自动触发'; en = '- Loop Engineering skill auto-trigger' }
    ab_feat4      = @{ zh = '- Codex 系统提示词部署'; en = '- Codex system prompt deployment' }
    ab_feat5      = @{ zh = '- settings.json 权限配置'; en = '- settings.json permission config' }
    ab_target     = @{ zh = '支持平台';   en = 'Supported Platforms' }
    ab_target_v   = @{ zh = 'Claude Code + OpenAI Codex'; en = 'Claude Code + OpenAI Codex' }
}

function T($k) {
    if ($script:S.ContainsKey($k)) { return $script:S[$k][$script:lang] }
    return $k
}

$script:tBindings = [System.Collections.ArrayList]::new()
function Bind-T($ctrl, $key) {
    $ctrl.Text = T $key
    [void]$script:tBindings.Add(@{ C = $ctrl; K = $key })
}

# === Helper Functions ===
function Copy-Safe($Src, $Dst) {
    for ($i = 0; $i -lt 3; $i++) {
        try { Copy-Item $Src $Dst -Force -ErrorAction Stop; return $true } catch {
            if ($i -lt 2) { Start-Sleep -Milliseconds (500 * ($i + 1)) }
        }
    }
    return $false
}

function Write-Utf8NoBom($FilePath, $Content) {
    try { [System.IO.File]::WriteAllText($FilePath, $Content, $UTF8NoBOM); return $true } catch {}
    try { $Content | Out-File -FilePath $FilePath -Encoding UTF8 -Force -ErrorAction Stop; return $true } catch {}
    return $false
}

function ConvertTo-ClaudeProjectPath([string]$WorkspacePath) {
    $resolved = (Resolve-Path $WorkspacePath -ErrorAction Stop).Path.TrimEnd('\')
    return ($resolved -replace ':', '-' -replace '\\', '-' -replace ' ', '-')
}

function Get-MemoryDir([string]$ProjectName) { return Join-Path $CLAUDE_PROJECTS "$ProjectName\memory" }

function Get-IndexEntry {
    $f = Join-Path $MEM_BUNDLE 'MEMORY.md'
    if (!(Test-Path $f)) { return $null }
    foreach ($line in [System.IO.File]::ReadAllLines($f, $UTF8NoBOM)) {
        if ($line -match 'security-research-lab') { return $line }
    }
    return $null
}

function Set-InstructionsFile($ConfigPath) {
    $line = 'model_instructions_file = "system-prompt.md"'
    if (!(Test-Path $ConfigPath)) { return (Write-Utf8NoBom $ConfigPath ($line + "`n")) }
    $existing = @(Get-Content $ConfigPath -ErrorAction SilentlyContinue)
    $kept = @($existing | Where-Object { $_ -notmatch '^\s*model_instructions_file\s*=' })
    $content = (@($line) + $kept) -join "`n"
    if (!$content.EndsWith("`n")) { $content += "`n" }
    return (Write-Utf8NoBom $ConfigPath $content)
}

function Remove-InstructionsFile($ConfigPath) {
    if (!(Test-Path $ConfigPath)) { return 'absent' }
    $existing = @(Get-Content $ConfigPath -ErrorAction SilentlyContinue)
    $kept = @($existing | Where-Object { $_ -notmatch '^\s*model_instructions_file\s*=' })
    $hasContent = ($kept | Where-Object { $_ -match '\S' }).Count -gt 0
    if ($hasContent) {
        $content = ($kept -join "`n"); if (!$content.EndsWith("`n")) { $content += "`n" }
        Write-Utf8NoBom $ConfigPath $content | Out-Null; return 'kept'
    }
    Remove-Item $ConfigPath -Force -ErrorAction SilentlyContinue; return 'removed'
}

function Resolve-WorkspacePath([string]$projName) {
    $possiblePath = ($projName -replace '^([A-Za-z])-', '$1:\') -replace '-', '\'
    if (Test-Path $possiblePath) { return $possiblePath }
    return $null
}

# === Version Detection ===
$script:ccVer    = $null
$script:codexVer = $null

function Detect-Versions {
    try {
        $cmd = Get-Command claude -ErrorAction Stop
        try {
            $out = & claude --version 2>$null | Select-Object -First 1
            if ($out) { $script:ccVer = $out.ToString().Trim() } else { $script:ccVer = T 'ov_installed' }
        } catch { $script:ccVer = T 'ov_installed' }
    } catch {
        if (Test-Path $CLAUDE_DIR) { $script:ccVer = 'config' } else { $script:ccVer = $null }
    }
    try {
        $cmd = Get-Command codex -ErrorAction Stop
        try {
            $out = & codex --version 2>$null | Select-Object -First 1
            if ($out) { $script:codexVer = $out.ToString().Trim() } else { $script:codexVer = T 'ov_installed' }
        } catch { $script:codexVer = T 'ov_installed' }
    } catch {
        if (Test-Path $CODEX_DIR) { $script:codexVer = 'config' } else { $script:codexVer = $null }
    }
}

# === GUI Log ===
$script:logBox = $null

function Log($msg, $color) {
    if ($script:logBox) {
        $script:logBox.SelectionStart = $script:logBox.TextLength
        $script:logBox.SelectionColor = $color
        $script:logBox.AppendText("$msg`r`n")
        $script:logBox.ScrollToCaret()
    }
}
function LogOk($msg)     { Log "[OK] $msg" $CLR_GREEN }
function LogFail($msg)   { Log "[FAIL] $msg" $CLR_RED }
function LogWarn($msg)   { Log "[!] $msg" $CLR_YELLOW }
function LogInfo($msg)   { Log "  $msg" $CLR_SUBTEXT }
function LogHeader($msg) { Log "`r`n--- $msg ---" $CLR_BLUE }

# === Core Operations ===
function Deploy-ToWorkspace([string]$ProjectName, [string]$WorkspacePath, [bool]$doSettings, [bool]$doSkill, [bool]$doCodex) {
    $memDir = Get-MemoryDir $ProjectName
    if (!(Test-Path $memDir)) { New-Item -ItemType Directory -Path $memDir -Force | Out-Null }
    LogHeader "Claude Code: $ProjectName"
    $src = Join-Path $MEM_BUNDLE 'security-research-lab.md'
    $dst = Join-Path $memDir 'security-research-lab.md'
    if ((Test-Path $src) -and (Copy-Safe $src $dst)) { LogOk "security-research-lab.md" } else { LogFail "security-research-lab.md" }
    $indexPath = Join-Path $memDir 'MEMORY.md'
    if (Test-Path $indexPath) {
        $content = [System.IO.File]::ReadAllText($indexPath, $UTF8NoBOM)
        if ($content -notmatch 'security-research-lab') {
            $entry = Get-IndexEntry
            if ($entry) { $content = $content.TrimEnd([char]13,[char]10) + [Environment]::NewLine + $entry + [Environment]::NewLine; [System.IO.File]::WriteAllText($indexPath, $content, $UTF8NoBOM) }
        }
        LogOk "MEMORY.md (merged)"
    } else {
        $idxSrc = Join-Path $MEM_BUNDLE 'MEMORY.md'
        if ((Test-Path $idxSrc) -and (Copy-Safe $idxSrc $indexPath)) { LogOk "MEMORY.md" } else { LogFail "MEMORY.md" }
    }
    if ($WorkspacePath -and (Test-Path $WorkspacePath)) {
        $cSrc = Join-Path $MEM_BUNDLE 'CLAUDE.md'
        $cDst = Join-Path $WorkspacePath 'CLAUDE.md'
        if ((Test-Path $cSrc) -and (Copy-Safe $cSrc $cDst)) { LogOk "CLAUDE.md -> workspace" } else { LogFail "CLAUDE.md" }
    }
    if ($doSkill -and $WorkspacePath -and (Test-Path $WorkspacePath)) {
        $skillSrc = Join-Path $SKILL_BUNDLE 'loop-sec.md'
        if (Test-Path $skillSrc) {
            $skillDir = Join-Path $WorkspacePath '.claude\skills'
            if (!(Test-Path $skillDir)) { New-Item -ItemType Directory -Path $skillDir -Force | Out-Null }
            $skillDst = Join-Path $skillDir 'loop-sec.md'
            if (Copy-Safe $skillSrc $skillDst) { LogOk "loop-sec.md -> .claude/skills/" } else { LogFail "loop-sec.md" }
        }
    }
    if ($doSettings) {
        $settingsPath = Join-Path $CLAUDE_DIR 'settings.json'
        if (Test-Path $settingsPath) { LogInfo "settings.json (exists, skip)" }
        else {
            $sSrc = Join-Path $CFG_BUNDLE 'settings.json'
            if ((Test-Path $sSrc) -and (Copy-Safe $sSrc $settingsPath)) { LogOk "settings.json (bypassPermissions)" } else { LogFail "settings.json" }
        }
    }
    if ($doCodex) { Deploy-CodexConfig }
    foreach ($f in @('CLAUDE.md', 'system-prompt.md')) {
        $p = Join-Path $CLAUDE_DIR $f
        if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue; LogInfo "Cleaned legacy $f from ~/.claude/" }
    }
}

function Uninstall-FromWorkspace([string]$ProjectName, [string]$WorkspacePath) {
    $memDir = Get-MemoryDir $ProjectName
    LogHeader "Removing: $ProjectName"
    $memFile = Join-Path $memDir 'security-research-lab.md'
    if (Test-Path $memFile) { Remove-Item $memFile -Force; LogOk "Removed security-research-lab.md" }
    $indexPath = Join-Path $memDir 'MEMORY.md'
    if (Test-Path $indexPath) {
        $lines = [System.IO.File]::ReadAllLines($indexPath, $UTF8NoBOM)
        $filtered = @($lines | Where-Object { $_ -notmatch 'security-research-lab' })
        $hasContent = ($filtered | Where-Object { $_.Trim() -ne '' }).Count -gt 0
        if ($hasContent) { [System.IO.File]::WriteAllLines($indexPath, $filtered, $UTF8NoBOM); LogOk "MEMORY.md (cleaned entry)" }
        else { Remove-Item $indexPath -Force; LogOk "Removed MEMORY.md" }
    }
    if ($WorkspacePath -and (Test-Path $WorkspacePath)) {
        $claudePath = Join-Path $WorkspacePath 'CLAUDE.md'
        if (Test-Path $claudePath) {
            $c = [System.IO.File]::ReadAllText($claudePath, $UTF8NoBOM)
            if ($c -match 'Security Research Workstation') { Remove-Item $claudePath -Force; LogOk "Removed CLAUDE.md" }
        }
        $skillPath = Join-Path $WorkspacePath '.claude\skills\loop-sec.md'
        if (Test-Path $skillPath) { Remove-Item $skillPath -Force; LogOk "Removed loop-sec.md" }
        $skillDir = Join-Path $WorkspacePath '.claude\skills'
        if ((Test-Path $skillDir) -and ((Get-ChildItem $skillDir -ErrorAction SilentlyContinue).Count -eq 0)) { Remove-Item $skillDir -Force -ErrorAction SilentlyContinue }
    }
    $sp = Join-Path $CLAUDE_DIR 'settings.json'
    if (Test-Path $sp) {
        $c = Get-Content $sp -Raw -ErrorAction SilentlyContinue
        if ($c -match 'bypassPermissions' -and $c -match 'skipDangerousModePermissionPrompt') { Remove-Item $sp -Force; LogOk "Removed settings.json" }
    }
}

function Deploy-CodexConfig {
    if (!(Test-Path $CODEX_BUNDLE)) { LogInfo "Codex bundle not found"; return }
    LogHeader "Codex"
    if (!(Test-Path $CODEX_DIR)) { New-Item -ItemType Directory -Path $CODEX_DIR -Force | Out-Null }
    $spSrc = Join-Path $CODEX_BUNDLE 'system-prompt.md'
    if (Test-Path $spSrc) {
        $dst = Join-Path $CODEX_DIR 'system-prompt.md'
        if (Copy-Safe $spSrc $dst) { $sz = (Get-Item $dst).Length; LogOk "system-prompt.md ($sz bytes)" } else { LogFail "system-prompt.md" }
    }
    $cfg = Join-Path $CODEX_DIR 'config.toml'
    if (Set-InstructionsFile $cfg) { LogOk "config.toml (merged)" } else { LogFail "config.toml" }
}

function Uninstall-CodexConfig {
    if (!(Test-Path $CODEX_DIR)) { return }
    LogHeader "Codex"
    foreach ($f in @('system-prompt.md', 'AGENTS.md')) {
        $p = Join-Path $CODEX_DIR $f
        if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue; LogOk "Removed $f" }
    }
    switch (Remove-InstructionsFile (Join-Path $CODEX_DIR 'config.toml')) {
        'removed' { LogOk "Removed config.toml" }
        'kept'    { LogInfo "config.toml (kept other settings)" }
    }
}

function Verify-Workspace([string]$ProjectName, [string]$WorkspacePath) {
    $memDir = Get-MemoryDir $ProjectName
    LogHeader "Verify: $ProjectName"
    $memFile = Join-Path $memDir 'security-research-lab.md'
    if (Test-Path $memFile) {
        $sz = (Get-Item $memFile).Length
        $c = Get-Content $memFile -Raw -ErrorAction SilentlyContinue
        $loop = if ($c -match 'Loop Engineering') { '+ Loop Engine' } else { '' }
        LogOk "security-research-lab.md ($sz bytes) $loop"
    } else { LogFail "security-research-lab.md MISSING" }
    $indexPath = Join-Path $memDir 'MEMORY.md'
    if (Test-Path $indexPath) {
        $c = Get-Content $indexPath -Raw -ErrorAction SilentlyContinue
        if ($c -match 'security-research-lab') { LogOk "MEMORY.md" } else { LogWarn "MEMORY.md entry missing" }
    } else { LogFail "MEMORY.md MISSING" }
    if ($WorkspacePath -and (Test-Path $WorkspacePath)) {
        $cp = Join-Path $WorkspacePath 'CLAUDE.md'
        if (Test-Path $cp) {
            $sz = (Get-Item $cp).Length
            $c = Get-Content $cp -Raw -ErrorAction SilentlyContinue
            $loop = if ($c -match 'Loop Engineering') { '+ Loop Engine' } else { '' }
            LogOk "CLAUDE.md ($sz bytes) $loop"
        } else { LogWarn "CLAUDE.md not found" }
        $sp = Join-Path $WorkspacePath '.claude\skills\loop-sec.md'
        if (Test-Path $sp) { $sz = (Get-Item $sp).Length; LogOk "loop-sec.md ($sz bytes)" }
        else { LogInfo "loop-sec.md not deployed" }
    }
}

# === Get Workspaces ===
function Get-Workspaces {
    $result = @()
    if (!(Test-Path $CLAUDE_PROJECTS)) { return $result }
    foreach ($d in (Get-ChildItem $CLAUDE_PROJECTS -Directory -ErrorAction SilentlyContinue)) {
        $memDir = Get-MemoryDir $d.Name
        $deployed = Test-Path (Join-Path $memDir 'security-research-lab.md')
        $hasLoop = $false
        if ($deployed) {
            $c = Get-Content (Join-Path $memDir 'security-research-lab.md') -Raw -ErrorAction SilentlyContinue
            $hasLoop = $c -match 'Loop Engineering'
        }
        $result += [PSCustomObject]@{ Name = $d.Name; Deployed = $deployed; HasLoop = $hasLoop; Path = $null }
    }
    return $result
}

# ================================================================
#                         BUILD GUI
# ================================================================

$form = New-Object System.Windows.Forms.Form
$form.Text = 'cc-unlock v5.0 - Loop Engineering'
$form.Size = New-Object System.Drawing.Size(880, 620)
$form.StartPosition = 'CenterScreen'
$form.BackColor = $CLR_BG
$form.ForeColor = $CLR_TEXT
$form.Font = $fBody
$form.FormBorderStyle = 'FixedSingle'
$form.MaximizeBox = $false

# ======================== SIDEBAR ========================
$sidebar = New-Object System.Windows.Forms.Panel
$sidebar.Dock = 'Left'
$sidebar.Width = 170
$sidebar.BackColor = $CLR_SIDEBAR
$form.Controls.Add($sidebar)

$sidebarLine = New-Object System.Windows.Forms.Panel
$sidebarLine.Location = New-Object System.Drawing.Point(169, 0)
$sidebarLine.Size = New-Object System.Drawing.Size(1, 620)
$sidebarLine.BackColor = $CLR_BORDER
$form.Controls.Add($sidebarLine)

# Sidebar title
$lblSideTitle = New-Object System.Windows.Forms.Label
$lblSideTitle.Text = 'cc-unlock'
$lblSideTitle.Font = $fNavTitle
$lblSideTitle.ForeColor = $CLR_MAUVE
$lblSideTitle.Location = New-Object System.Drawing.Point(16, 18)
$lblSideTitle.AutoSize = $true
$lblSideTitle.BackColor = $CLR_SIDEBAR
$sidebar.Controls.Add($lblSideTitle)

$lblSideVer = New-Object System.Windows.Forms.Label
$lblSideVer.Text = 'v5.0'
$lblSideVer.Font = $fNavSub
$lblSideVer.ForeColor = $CLR_SUBTEXT
$lblSideVer.Location = New-Object System.Drawing.Point(18, 48)
$lblSideVer.AutoSize = $true
$lblSideVer.BackColor = $CLR_SIDEBAR
$sidebar.Controls.Add($lblSideVer)

$sidebarSep = New-Object System.Windows.Forms.Panel
$sidebarSep.Location = New-Object System.Drawing.Point(16, 72)
$sidebarSep.Size = New-Object System.Drawing.Size(138, 1)
$sidebarSep.BackColor = $CLR_BORDER
$sidebar.Controls.Add($sidebarSep)

# === Navigation Items ===
$script:navItems = @()
$script:pages = @{}

function New-NavItem([string]$key, [int]$y) {
    $panel = New-Object System.Windows.Forms.Panel
    $panel.Location = New-Object System.Drawing.Point(0, $y)
    $panel.Size = New-Object System.Drawing.Size(169, 38)
    $panel.BackColor = $CLR_SIDEBAR
    $panel.Cursor = [System.Windows.Forms.Cursors]::Hand

    $indicator = New-Object System.Windows.Forms.Panel
    $indicator.Location = New-Object System.Drawing.Point(0, 0)
    $indicator.Size = New-Object System.Drawing.Size(3, 38)
    $indicator.BackColor = $CLR_SIDEBAR
    $panel.Controls.Add($indicator)

    $label = New-Object System.Windows.Forms.Label
    $label.Text = T $key
    $label.Font = $fNav
    $label.ForeColor = $CLR_SUBTEXT
    $label.Location = New-Object System.Drawing.Point(10, 0)
    $label.Size = New-Object System.Drawing.Size(156, 38)
    $label.TextAlign = 'MiddleLeft'
    $label.BackColor = [System.Drawing.Color]::Transparent
    $label.Cursor = [System.Windows.Forms.Cursors]::Hand
    $panel.Controls.Add($label)

    $sidebar.Controls.Add($panel)

    $item = @{ Panel = $panel; Indicator = $indicator; Label = $label; Key = $key; PageKey = '' }

    $clickHandler = {
        param($sender, $e)
        $navKey = $sender.Tag
        Switch-Page $navKey
    }.GetNewClosure()

    $panel.Tag = $key
    $label.Tag = $key
    $panel.Add_Click($clickHandler)
    $label.Add_Click($clickHandler)

    $panel.Add_MouseEnter({ if ($this.BackColor -ne $CLR_NAV_ACTIVE) { $this.BackColor = $CLR_NAV_HOVER } })
    $panel.Add_MouseLeave({ if ($this.BackColor -ne $CLR_NAV_ACTIVE) { $this.BackColor = $CLR_SIDEBAR } })

    return $item
}

$navOverview  = New-NavItem 'nav_overview' 85
$navDeploy    = New-NavItem 'nav_deploy' 123
$navSettings  = New-NavItem 'nav_settings' 161
$navAbout     = New-NavItem 'nav_about' 490

$script:navItems = @($navOverview, $navDeploy, $navSettings, $navAbout)

# ======================== CONTENT AREA ========================
$content = New-Object System.Windows.Forms.Panel
$content.Dock = 'Fill'
$content.BackColor = $CLR_BG
$content.Padding = New-Object System.Windows.Forms.Padding(0)
$form.Controls.Add($content)
$content.BringToFront()

# Helper: create section header (small uppercase label)
function New-SectionHeader([string]$key, [int]$x, [int]$y, [System.Windows.Forms.Control]$parent) {
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = T $key
    $lbl.Font = $fSection
    $lbl.ForeColor = $CLR_SUBTEXT
    $lbl.Location = New-Object System.Drawing.Point($x, $y)
    $lbl.AutoSize = $true
    $parent.Controls.Add($lbl)
    [void]$script:tBindings.Add(@{ C = $lbl; K = $key })
    return $lbl
}

# Helper: create info row (label + value)
function New-InfoRow([string]$labelText, [int]$x, [int]$y, [int]$labelW, [System.Windows.Forms.Control]$parent) {
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = $labelText
    $lbl.Font = $fBody
    $lbl.ForeColor = $CLR_SUBTEXT
    $lbl.Location = New-Object System.Drawing.Point($x, $y)
    $lbl.Size = New-Object System.Drawing.Size($labelW, 22)
    $lbl.TextAlign = 'MiddleLeft'
    $parent.Controls.Add($lbl)

    $val = New-Object System.Windows.Forms.Label
    $val.Text = ''
    $val.Font = $fBody
    $val.ForeColor = $CLR_TEXT
    $val.Location = New-Object System.Drawing.Point(($x + $labelW), $y)
    $val.AutoSize = $true
    $parent.Controls.Add($val)

    return @{ Label = $lbl; Value = $val }
}

# Helper: create card panel
function New-Card([int]$x, [int]$y, [int]$w, [int]$h, [System.Windows.Forms.Control]$parent) {
    $card = New-Object System.Windows.Forms.Panel
    $card.Location = New-Object System.Drawing.Point($x, $y)
    $card.Size = New-Object System.Drawing.Size($w, $h)
    $card.BackColor = $CLR_SURFACE
    $parent.Controls.Add($card)
    return $card
}

# ======================== PAGE: OVERVIEW ========================
$pageOverview = New-Object System.Windows.Forms.Panel
$pageOverview.Dock = 'Fill'
$pageOverview.BackColor = $CLR_BG
$pageOverview.AutoScroll = $true
$content.Controls.Add($pageOverview)

# OV: Title
$ovTitle = New-Object System.Windows.Forms.Label
$ovTitle.Text = 'cc-unlock v5.0'
$ovTitle.Font = New-Object System.Drawing.Font($fontFamily, 18, [System.Drawing.FontStyle]::Bold)
$ovTitle.ForeColor = $CLR_MAUVE
$ovTitle.Location = New-Object System.Drawing.Point(25, 18)
$ovTitle.AutoSize = $true
$pageOverview.Controls.Add($ovTitle)

$ovSub = New-Object System.Windows.Forms.Label
$ovSub.Text = 'Loop Engineering + Security Research Authorization'
$ovSub.Font = $fBody
$ovSub.ForeColor = $CLR_SUBTEXT
$ovSub.Location = New-Object System.Drawing.Point(27, 52)
$ovSub.AutoSize = $true
$pageOverview.Controls.Add($ovSub)

# OV: Environment Detection Card
New-SectionHeader 'sec_env' 25 85 $pageOverview | Out-Null
$ovEnvCard = New-Card 25 108 645 145 $pageOverview

$ovRowCC   = New-InfoRow (T 'ov_cc_ver') 18 15 170 $ovEnvCard
$script:ovCCBadge = New-Object System.Windows.Forms.Label
$script:ovCCBadge.Font = $fBodyBold
$script:ovCCBadge.Location = New-Object System.Drawing.Point(400, 15)
$script:ovCCBadge.AutoSize = $true
$ovEnvCard.Controls.Add($script:ovCCBadge)

$ovRowCodex = New-InfoRow (T 'ov_codex_ver') 18 45 170 $ovEnvCard
$script:ovCodexBadge = New-Object System.Windows.Forms.Label
$script:ovCodexBadge.Font = $fBodyBold
$script:ovCodexBadge.Location = New-Object System.Drawing.Point(400, 45)
$script:ovCodexBadge.AutoSize = $true
$ovEnvCard.Controls.Add($script:ovCodexBadge)

$ovRowCCHome    = New-InfoRow 'CLAUDE HOME' 18 82 170 $ovEnvCard
$ovRowCodexHome = New-InfoRow 'CODEX HOME'  18 112 170 $ovEnvCard

$script:ovEnvRows = @{
    CC = $ovRowCC; Codex = $ovRowCodex
    CCBadge = $script:ovCCBadge; CodexBadge = $script:ovCodexBadge
    CCHome = $ovRowCCHome; CodexHome = $ovRowCodexHome
}

# OV: Bundle Status Card
New-SectionHeader 'sec_bundle' 25 262 $pageOverview | Out-Null
$ovBundleCard = New-Card 25 285 645 120 $pageOverview

$script:ovBundleRows = @()
$bundleItems = @(
    @{ Name = 'Memory Bundle';  Path = $MEM_BUNDLE },
    @{ Name = 'Config Bundle';  Path = $CFG_BUNDLE },
    @{ Name = 'Skill Bundle';   Path = $SKILL_BUNDLE },
    @{ Name = 'Codex Bundle';   Path = $CODEX_BUNDLE }
)
for ($i = 0; $i -lt $bundleItems.Count; $i++) {
    $bi = $bundleItems[$i]
    $row = New-InfoRow $bi.Name 18 (12 + $i * 25) 170 $ovBundleCard
    $script:ovBundleRows += @{ Row = $row; Path = $bi.Path }
}

# OV: Workspace Summary Card
New-SectionHeader 'sec_ws_sum' 25 415 $pageOverview | Out-Null
$ovWsCard = New-Card 25 438 645 75 $pageOverview

$script:ovRowDeployed = New-InfoRow (T 'ov_deployed') 18 12 170 $ovWsCard
$script:ovRowLoop     = New-InfoRow (T 'ov_loop_cnt') 18 42 170 $ovWsCard

# OV: Refresh function
function Refresh-OverviewPage {
    # Version detection display
    $rows = $script:ovEnvRows
    if ($script:ccVer) {
        $ver = if ($script:ccVer -eq 'config') { T 'ov_cfg_found' } else { $script:ccVer }
        $rows.CC.Value.Text = $ver
        $rows.CC.Value.ForeColor = $CLR_GREEN
        $badge = if ($script:ccVer -eq 'config') { T 'ov_cfg_found' } else { T 'ov_installed' }
        $rows.CCBadge.Text = $badge
        $rows.CCBadge.ForeColor = if ($script:ccVer -eq 'config') { $CLR_YELLOW } else { $CLR_GREEN }
    } else {
        $rows.CC.Value.Text = '-'
        $rows.CC.Value.ForeColor = $CLR_RED
        $rows.CCBadge.Text = T 'ov_not_found'
        $rows.CCBadge.ForeColor = $CLR_RED
    }
    if ($script:codexVer) {
        $ver = if ($script:codexVer -eq 'config') { T 'ov_cfg_found' } else { $script:codexVer }
        $rows.Codex.Value.Text = $ver
        $rows.Codex.Value.ForeColor = $CLR_GREEN
        $badge = if ($script:codexVer -eq 'config') { T 'ov_cfg_found' } else { T 'ov_installed' }
        $rows.CodexBadge.Text = $badge
        $rows.CodexBadge.ForeColor = if ($script:codexVer -eq 'config') { $CLR_YELLOW } else { $CLR_GREEN }
    } else {
        $rows.Codex.Value.Text = '-'
        $rows.Codex.Value.ForeColor = $CLR_RED
        $rows.CodexBadge.Text = T 'ov_not_found'
        $rows.CodexBadge.ForeColor = $CLR_RED
    }
    $rows.CCHome.Value.Text    = $CLAUDE_DIR
    $rows.CCHome.Value.ForeColor = if (Test-Path $CLAUDE_DIR) { $CLR_TEXT } else { $CLR_SUBTEXT }
    $rows.CodexHome.Value.Text = $CODEX_DIR
    $rows.CodexHome.Value.ForeColor = if (Test-Path $CODEX_DIR) { $CLR_TEXT } else { $CLR_SUBTEXT }

    # Bundle status
    foreach ($b in $script:ovBundleRows) {
        if (Test-Path $b.Path) {
            $b.Row.Value.Text = T 'ov_ready'
            $b.Row.Value.ForeColor = $CLR_GREEN
        } else {
            $b.Row.Value.Text = T 'ov_missing'
            $b.Row.Value.ForeColor = $CLR_RED
        }
    }

    # Workspace summary
    $ws = Get-Workspaces
    $depCount = @($ws | Where-Object { $_.Deployed }).Count
    $loopCount = @($ws | Where-Object { $_.HasLoop }).Count
    $script:ovRowDeployed.Value.Text = "$depCount"
    $script:ovRowDeployed.Value.ForeColor = if ($depCount -gt 0) { $CLR_GREEN } else { $CLR_SUBTEXT }
    $script:ovRowLoop.Value.Text = "$loopCount"
    $script:ovRowLoop.Value.ForeColor = if ($loopCount -gt 0) { $CLR_GREEN } else { $CLR_SUBTEXT }

    # Update translatable labels
    $rows.CC.Label.Text    = T 'ov_cc_ver'
    $rows.Codex.Label.Text = T 'ov_codex_ver'
    $script:ovRowDeployed.Label.Text = T 'ov_deployed'
    $script:ovRowLoop.Label.Text     = T 'ov_loop_cnt'
}

# ======================== PAGE: DEPLOY ========================
$pageDeploy = New-Object System.Windows.Forms.Panel
$pageDeploy.Dock = 'Fill'
$pageDeploy.BackColor = $CLR_BG
$pageDeploy.Visible = $false
$content.Controls.Add($pageDeploy)

# DP: Title
$dpTitle = New-Object System.Windows.Forms.Label
$dpTitle.Font = $fPageTitle
$dpTitle.ForeColor = $CLR_MAUVE
$dpTitle.Location = New-Object System.Drawing.Point(25, 15)
$dpTitle.AutoSize = $true
$pageDeploy.Controls.Add($dpTitle)
Bind-T $dpTitle 'dp_title'

# DP: Workspace List
$listView = New-Object System.Windows.Forms.ListView
$listView.Location = New-Object System.Drawing.Point(25, 48)
$listView.Size = New-Object System.Drawing.Size(645, 170)
$listView.View = 'Details'
$listView.FullRowSelect = $true
$listView.CheckBoxes = $true
$listView.BackColor = $CLR_SURFACE
$listView.ForeColor = $CLR_TEXT
$listView.BorderStyle = 'None'
$listView.Font = $fMono
$listView.HeaderStyle = 'Nonclickable'
$script:colWs     = $listView.Columns.Add((T 'dp_ws'), 420)
$script:colStatus = $listView.Columns.Add((T 'dp_status'), 110)
$script:colLoop   = $listView.Columns.Add((T 'dp_loop'), 100)
$pageDeploy.Controls.Add($listView)

function Refresh-WorkspaceList {
    $listView.Items.Clear()
    $workspaces = Get-Workspaces
    foreach ($ws in $workspaces) {
        $item = New-Object System.Windows.Forms.ListViewItem($ws.Name)
        $status = if ($ws.Deployed) { T 'dp_deployed' } else { T 'dp_not_dep' }
        $loop = if ($ws.HasLoop) { T 'dp_active' } else { '-' }
        $item.SubItems.Add($status) | Out-Null
        $item.SubItems.Add($loop) | Out-Null
        $item.ForeColor = if ($ws.Deployed) { $CLR_GREEN } else { $CLR_SUBTEXT }
        $item.Tag = $ws
        $listView.Items.Add($item) | Out-Null
    }
}

# DP: Custom path
$dpLblCustom = New-Object System.Windows.Forms.Label
$dpLblCustom.Font = $fBody
$dpLblCustom.ForeColor = $CLR_SUBTEXT
$dpLblCustom.Location = New-Object System.Drawing.Point(25, 227)
$dpLblCustom.AutoSize = $true
$pageDeploy.Controls.Add($dpLblCustom)
Bind-T $dpLblCustom 'dp_custom'

$txtPath = New-Object System.Windows.Forms.TextBox
$txtPath.Location = New-Object System.Drawing.Point(135, 224)
$txtPath.Size = New-Object System.Drawing.Size(440, 24)
$txtPath.BackColor = $CLR_SURFACE
$txtPath.ForeColor = $CLR_TEXT
$txtPath.BorderStyle = 'FixedSingle'
$txtPath.Font = $fMono
$pageDeploy.Controls.Add($txtPath)

$btnBrowse = New-Object System.Windows.Forms.Button
$btnBrowse.Font = $fBtn
$btnBrowse.FlatStyle = 'Flat'
$btnBrowse.BackColor = $CLR_BTN
$btnBrowse.ForeColor = $CLR_TEXT
$btnBrowse.FlatAppearance.BorderColor = $CLR_BORDER
$btnBrowse.Location = New-Object System.Drawing.Point(585, 222)
$btnBrowse.Size = New-Object System.Drawing.Size(85, 26)
$btnBrowse.Cursor = [System.Windows.Forms.Cursors]::Hand
$pageDeploy.Controls.Add($btnBrowse)
Bind-T $btnBrowse 'dp_browse'

$btnBrowse.Add_Click({
    $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
    $dlg.Description = T 'dp_sel_folder'
    $dlg.ShowNewFolderButton = $false
    if ($dlg.ShowDialog() -eq 'OK') { $txtPath.Text = $dlg.SelectedPath }
})

# DP: Options
$dpLblOpt = New-Object System.Windows.Forms.Label
$dpLblOpt.Font = $fSection
$dpLblOpt.ForeColor = $CLR_SUBTEXT
$dpLblOpt.Location = New-Object System.Drawing.Point(25, 258)
$dpLblOpt.AutoSize = $true
$pageDeploy.Controls.Add($dpLblOpt)
Bind-T $dpLblOpt 'dp_options'

$chkSettings = New-Object System.Windows.Forms.CheckBox
$chkSettings.Checked = $true
$chkSettings.ForeColor = $CLR_TEXT
$chkSettings.Font = $fBody
$chkSettings.Location = New-Object System.Drawing.Point(28, 278)
$chkSettings.AutoSize = $true
$pageDeploy.Controls.Add($chkSettings)
Bind-T $chkSettings 'dp_opt_set'

$chkSkill = New-Object System.Windows.Forms.CheckBox
$chkSkill.Checked = $true
$chkSkill.ForeColor = $CLR_TEXT
$chkSkill.Font = $fBody
$chkSkill.Location = New-Object System.Drawing.Point(28, 300)
$chkSkill.AutoSize = $true
$pageDeploy.Controls.Add($chkSkill)
Bind-T $chkSkill 'dp_opt_skill'

$chkCodex = New-Object System.Windows.Forms.CheckBox
$chkCodex.Checked = $true
$chkCodex.ForeColor = $CLR_TEXT
$chkCodex.Font = $fBody
$chkCodex.Location = New-Object System.Drawing.Point(330, 300)
$chkCodex.AutoSize = $true
$pageDeploy.Controls.Add($chkCodex)
Bind-T $chkCodex 'dp_opt_codex'

# DP: Action Buttons
function New-ActionButton([string]$key, [int]$x, [int]$y, [int]$w, [System.Drawing.Color]$bg) {
    $btn = New-Object System.Windows.Forms.Button
    $btn.Text = T $key
    $btn.Location = New-Object System.Drawing.Point($x, $y)
    $btn.Size = New-Object System.Drawing.Size($w, 32)
    $btn.FlatStyle = 'Flat'
    $btn.BackColor = $bg
    $btn.ForeColor = $CLR_TEXT
    $btn.Font = $fBtn
    $btn.FlatAppearance.BorderColor = $CLR_BORDER
    $btn.Cursor = [System.Windows.Forms.Cursors]::Hand
    $pageDeploy.Controls.Add($btn)
    [void]$script:tBindings.Add(@{ C = $btn; K = $key })
    return $btn
}

$btnY = 328
$btnDeploySel  = New-ActionButton 'dp_deploy_sel'  25  $btnY 120 $CLR_BTN_GREEN
$btnDeployAll  = New-ActionButton 'dp_deploy_all'  153 $btnY 110 $CLR_BTN_GREEN
$btnUninstSel  = New-ActionButton 'dp_uninst_sel'  271 $btnY 120 $CLR_BTN_RED
$btnUninstAll  = New-ActionButton 'dp_uninst_all'  399 $btnY 110 $CLR_BTN_RED
$btnVerify     = New-ActionButton 'dp_verify'      517 $btnY 75  $CLR_BTN
$btnRefresh    = New-ActionButton 'dp_refresh'     600 $btnY 70  $CLR_BTN

# DP: Log
$dpLblLog = New-Object System.Windows.Forms.Label
$dpLblLog.Font = $fSection
$dpLblLog.ForeColor = $CLR_SUBTEXT
$dpLblLog.Location = New-Object System.Drawing.Point(25, 368)
$dpLblLog.AutoSize = $true
$pageDeploy.Controls.Add($dpLblLog)
Bind-T $dpLblLog 'dp_log'

$logBox = New-Object System.Windows.Forms.RichTextBox
$logBox.Location = New-Object System.Drawing.Point(25, 388)
$logBox.Size = New-Object System.Drawing.Size(645, 175)
$logBox.BackColor = $CLR_SURFACE
$logBox.ForeColor = $CLR_TEXT
$logBox.BorderStyle = 'None'
$logBox.ReadOnly = $true
$logBox.Font = $fMono
$logBox.ScrollBars = 'Vertical'
$pageDeploy.Controls.Add($logBox)
$script:logBox = $logBox

# DP: Button Handlers
$btnDeploySel.Add_Click({
    $logBox.Clear()
    if ($txtPath.Text -and (Test-Path $txtPath.Text)) {
        $projName = ConvertTo-ClaudeProjectPath $txtPath.Text
        Deploy-ToWorkspace $projName $txtPath.Text $chkSettings.Checked $chkSkill.Checked $chkCodex.Checked
        Log ("`r`n" + (T 'dp_done')) $CLR_MAUVE
        Refresh-WorkspaceList; return
    }
    $checked = @($listView.CheckedItems)
    if ($checked.Count -eq 0) { LogWarn (T 'dp_no_sel'); return }
    foreach ($item in $checked) {
        $wsPath = Resolve-WorkspacePath $item.Text
        Deploy-ToWorkspace $item.Text $wsPath $chkSettings.Checked $chkSkill.Checked $chkCodex.Checked
    }
    Log ("`r`n" + (T 'dp_done')) $CLR_MAUVE
    Refresh-WorkspaceList
})

$btnDeployAll.Add_Click({
    $logBox.Clear()
    $count = 0
    foreach ($item in $listView.Items) {
        $wsPath = Resolve-WorkspacePath $item.Text
        Deploy-ToWorkspace $item.Text $wsPath $chkSettings.Checked $chkSkill.Checked $chkCodex.Checked
        $count++
    }
    if ($count -eq 0) { LogWarn (T 'dp_no_sel'); return }
    Log ("`r`n" + (T 'dp_done')) $CLR_MAUVE
    Refresh-WorkspaceList
})

$btnUninstSel.Add_Click({
    $logBox.Clear()
    $checked = @($listView.CheckedItems)
    if ($checked.Count -eq 0) { LogWarn (T 'dp_no_sel'); return }
    foreach ($item in $checked) {
        $wsPath = Resolve-WorkspacePath $item.Text
        Uninstall-FromWorkspace $item.Text $wsPath
    }
    Uninstall-CodexConfig
    Log ("`r`n" + (T 'dp_done')) $CLR_MAUVE
    Refresh-WorkspaceList
})

$btnUninstAll.Add_Click({
    $logBox.Clear()
    $count = 0
    foreach ($item in $listView.Items) {
        $ws = $item.Tag
        if ($ws.Deployed) {
            $wsPath = Resolve-WorkspacePath $item.Text
            Uninstall-FromWorkspace $item.Text $wsPath
            $count++
        }
    }
    Uninstall-CodexConfig
    $sp = Join-Path $CLAUDE_DIR 'settings.json'
    if (Test-Path $sp) {
        $c = Get-Content $sp -Raw -ErrorAction SilentlyContinue
        if ($c -match 'bypassPermissions' -and $c -match 'skipDangerousModePermissionPrompt') { Remove-Item $sp -Force; LogOk "Removed settings.json" }
    }
    if ($count -eq 0) { LogInfo "No deployed workspaces found." }
    else { Log ("`r`n" + (T 'dp_done')) $CLR_MAUVE }
    Refresh-WorkspaceList
})

$btnVerify.Add_Click({
    $logBox.Clear()
    $checked = @($listView.CheckedItems)
    if ($checked.Count -gt 0) {
        foreach ($item in $checked) { Verify-Workspace $item.Text (Resolve-WorkspacePath $item.Text) }
    } else {
        foreach ($item in $listView.Items) {
            $ws = $item.Tag
            if ($ws.Deployed) { Verify-Workspace $item.Text (Resolve-WorkspacePath $item.Text) }
        }
    }
    LogHeader "Global"
    $sp = Join-Path $CLAUDE_DIR 'settings.json'
    if (Test-Path $sp) { LogOk "settings.json" } else { LogInfo "settings.json not found" }
    if (Test-Path $CODEX_DIR) {
        LogHeader "Codex"
        foreach ($c in @(
            @{ File = 'system-prompt.md'; Pattern = 'Loop Engineering|cc-unlock|UNRESTRICTED' },
            @{ File = 'config.toml';      Pattern = 'system-prompt.md' }
        )) {
            $p = Join-Path $CODEX_DIR $c.File
            if (Test-Path $p) {
                $sz = (Get-Item $p).Length
                $ct = Get-Content $p -Raw -ErrorAction SilentlyContinue
                if ($ct -match $c.Pattern) { LogOk "$($c.File) ($sz bytes)" } else { LogWarn "$($c.File) - content mismatch" }
            } else { LogFail "$($c.File) MISSING" }
        }
    }
})

$btnRefresh.Add_Click({ $logBox.Clear(); Refresh-WorkspaceList; LogInfo (T 'dp_refreshed') })

# ======================== PAGE: SETTINGS ========================
$pageSettings = New-Object System.Windows.Forms.Panel
$pageSettings.Dock = 'Fill'
$pageSettings.BackColor = $CLR_BG
$pageSettings.Visible = $false
$content.Controls.Add($pageSettings)

# ST: Title
$stTitle = New-Object System.Windows.Forms.Label
$stTitle.Font = $fPageTitle
$stTitle.ForeColor = $CLR_MAUVE
$stTitle.Location = New-Object System.Drawing.Point(25, 15)
$stTitle.AutoSize = $true
$pageSettings.Controls.Add($stTitle)
Bind-T $stTitle 'st_title'

# ST: Language section
$stLblLang = New-Object System.Windows.Forms.Label
$stLblLang.Font = $fSection
$stLblLang.ForeColor = $CLR_SUBTEXT
$stLblLang.Location = New-Object System.Drawing.Point(25, 60)
$stLblLang.AutoSize = $true
$pageSettings.Controls.Add($stLblLang)
Bind-T $stLblLang 'st_lang'

$stLangCard = New-Card 25 83 645 55 $pageSettings

$rbZh = New-Object System.Windows.Forms.RadioButton
$rbZh.Text = '中文'
$rbZh.Font = $fBody
$rbZh.ForeColor = $CLR_TEXT
$rbZh.Checked = $true
$rbZh.Location = New-Object System.Drawing.Point(18, 15)
$rbZh.AutoSize = $true
$stLangCard.Controls.Add($rbZh)

$rbEn = New-Object System.Windows.Forms.RadioButton
$rbEn.Text = 'English'
$rbEn.Font = $fBody
$rbEn.ForeColor = $CLR_TEXT
$rbEn.Checked = $false
$rbEn.Location = New-Object System.Drawing.Point(120, 15)
$rbEn.AutoSize = $true
$stLangCard.Controls.Add($rbEn)

$rbZh.Add_CheckedChanged({
    if ($rbZh.Checked) { $script:lang = 'zh'; Apply-Language }
})
$rbEn.Add_CheckedChanged({
    if ($rbEn.Checked) { $script:lang = 'en'; Apply-Language }
})

# ST: Paths section
$stLblPaths = New-Object System.Windows.Forms.Label
$stLblPaths.Font = $fSection
$stLblPaths.ForeColor = $CLR_SUBTEXT
$stLblPaths.Location = New-Object System.Drawing.Point(25, 152)
$stLblPaths.AutoSize = $true
$pageSettings.Controls.Add($stLblPaths)
Bind-T $stLblPaths 'st_paths'

$stPathCard = New-Card 25 175 645 115 $pageSettings

$stRowBundle = New-InfoRow (T 'st_bundle') 18 15 160 $stPathCard
$stRowBundle.Value.Text = $CC_FILES
$stRowBundle.Value.Font = $fMono
$stRowBundle.Value.ForeColor = $CLR_TEXT

$stRowCC = New-InfoRow (T 'st_cc_dir') 18 48 160 $stPathCard
$stRowCC.Value.Text = $CLAUDE_DIR
$stRowCC.Value.Font = $fMono
$stRowCC.Value.ForeColor = $CLR_TEXT

$stRowCodex = New-InfoRow (T 'st_codex_dir') 18 81 160 $stPathCard
$stRowCodex.Value.Text = $CODEX_DIR
$stRowCodex.Value.Font = $fMono
$stRowCodex.Value.ForeColor = $CLR_TEXT

$script:stPathRows = @{ Bundle = $stRowBundle; CC = $stRowCC; Codex = $stRowCodex }

# ======================== PAGE: ABOUT ========================
$pageAbout = New-Object System.Windows.Forms.Panel
$pageAbout.Dock = 'Fill'
$pageAbout.BackColor = $CLR_BG
$pageAbout.Visible = $false
$content.Controls.Add($pageAbout)

# AB: Section header
$abSec = New-Object System.Windows.Forms.Label
$abSec.Font = $fSection
$abSec.ForeColor = $CLR_SUBTEXT
$abSec.Location = New-Object System.Drawing.Point(25, 15)
$abSec.AutoSize = $true
$pageAbout.Controls.Add($abSec)
Bind-T $abSec 'ab_section'

# AB: Title
$abTitle = New-Object System.Windows.Forms.Label
$abTitle.Font = $fPageTitle
$abTitle.ForeColor = $CLR_TEXT
$abTitle.Location = New-Object System.Drawing.Point(25, 38)
$abTitle.AutoSize = $true
$pageAbout.Controls.Add($abTitle)
Bind-T $abTitle 'ab_title'

# AB: Info card
$abInfoCard = New-Card 25 75 645 155 $pageAbout

$abRowVer   = New-InfoRow (T 'ab_version') 18 15 170 $abInfoCard
$abRowVer.Value.Text = '6.0'
$abRowVer.Value.ForeColor = $CLR_MAUVE

$abRowCC    = New-InfoRow (T 'ov_cc_ver') 18 45 170 $abInfoCard
$script:abCCBadge = New-Object System.Windows.Forms.Label
$script:abCCBadge.Font = $fBodyBold
$script:abCCBadge.Location = New-Object System.Drawing.Point(400, 45)
$script:abCCBadge.AutoSize = $true
$abInfoCard.Controls.Add($script:abCCBadge)

$abRowCodex = New-InfoRow (T 'ov_codex_ver') 18 75 170 $abInfoCard
$script:abCodexBadge = New-Object System.Windows.Forms.Label
$script:abCodexBadge.Font = $fBodyBold
$script:abCodexBadge.Location = New-Object System.Drawing.Point(400, 75)
$script:abCodexBadge.AutoSize = $true
$abInfoCard.Controls.Add($script:abCodexBadge)

$abRowTarget = New-InfoRow (T 'ab_target') 18 112 170 $abInfoCard
$abRowTarget.Value.Text = T 'ab_target_v'
$abRowTarget.Value.ForeColor = $CLR_TEAL

$script:abInfoRows = @{ Ver = $abRowVer; CC = $abRowCC; Codex = $abRowCodex; Target = $abRowTarget }

# AB: Description
$abDescSec = New-Object System.Windows.Forms.Label
$abDescSec.Font = $fSection
$abDescSec.ForeColor = $CLR_SUBTEXT
$abDescSec.Location = New-Object System.Drawing.Point(25, 242)
$abDescSec.AutoSize = $true
$pageAbout.Controls.Add($abDescSec)
Bind-T $abDescSec 'ab_desc_title'

$abDescCard = New-Card 25 265 645 45 $pageAbout
$abDesc = New-Object System.Windows.Forms.Label
$abDesc.Font = $fBody
$abDesc.ForeColor = $CLR_TEXT
$abDesc.Location = New-Object System.Drawing.Point(18, 12)
$abDesc.Size = New-Object System.Drawing.Size(610, 22)
$abDescCard.Controls.Add($abDesc)
Bind-T $abDesc 'ab_desc'

# AB: Features
$abFeatSec = New-Object System.Windows.Forms.Label
$abFeatSec.Font = $fSection
$abFeatSec.ForeColor = $CLR_SUBTEXT
$abFeatSec.Location = New-Object System.Drawing.Point(25, 322)
$abFeatSec.AutoSize = $true
$pageAbout.Controls.Add($abFeatSec)
Bind-T $abFeatSec 'ab_feat_title'

$abFeatCard = New-Card 25 345 645 140 $pageAbout

$featKeys = @('ab_feat1','ab_feat2','ab_feat3','ab_feat4','ab_feat5')
$script:abFeatLabels = @()
for ($i = 0; $i -lt $featKeys.Count; $i++) {
    $fl = New-Object System.Windows.Forms.Label
    $fl.Font = $fBody
    $fl.ForeColor = $CLR_TEXT
    $fl.Location = New-Object System.Drawing.Point(18, (12 + $i * 24))
    $fl.Size = New-Object System.Drawing.Size(610, 22)
    $abFeatCard.Controls.Add($fl)
    Bind-T $fl $featKeys[$i]
    $script:abFeatLabels += $fl
}

# AB: Refresh function
function Refresh-AboutPage {
    $rows = $script:abInfoRows
    $rows.Ver.Label.Text = T 'ab_version'
    $rows.CC.Label.Text  = T 'ov_cc_ver'
    $rows.Codex.Label.Text = T 'ov_codex_ver'
    $rows.Target.Label.Text = T 'ab_target'
    $rows.Target.Value.Text = T 'ab_target_v'

    if ($script:ccVer) {
        $ver = if ($script:ccVer -eq 'config') { T 'ov_cfg_found' } else { $script:ccVer }
        $rows.CC.Value.Text = $ver
        $rows.CC.Value.ForeColor = $CLR_GREEN
        $badge = if ($script:ccVer -eq 'config') { T 'ov_cfg_found' } else { T 'ov_installed' }
        $script:abCCBadge.Text = $badge
        $script:abCCBadge.ForeColor = if ($script:ccVer -eq 'config') { $CLR_YELLOW } else { $CLR_GREEN }
    } else {
        $rows.CC.Value.Text = '-'
        $rows.CC.Value.ForeColor = $CLR_RED
        $script:abCCBadge.Text = T 'ov_not_found'
        $script:abCCBadge.ForeColor = $CLR_RED
    }
    if ($script:codexVer) {
        $ver = if ($script:codexVer -eq 'config') { T 'ov_cfg_found' } else { $script:codexVer }
        $rows.Codex.Value.Text = $ver
        $rows.Codex.Value.ForeColor = $CLR_GREEN
        $badge = if ($script:codexVer -eq 'config') { T 'ov_cfg_found' } else { T 'ov_installed' }
        $script:abCodexBadge.Text = $badge
        $script:abCodexBadge.ForeColor = if ($script:codexVer -eq 'config') { $CLR_YELLOW } else { $CLR_GREEN }
    } else {
        $rows.Codex.Value.Text = '-'
        $rows.Codex.Value.ForeColor = $CLR_RED
        $script:abCodexBadge.Text = T 'ov_not_found'
        $script:abCodexBadge.ForeColor = $CLR_RED
    }
}

# ======================== NAVIGATION ========================
$script:currentNav = $null

function Switch-Page([string]$navKey) {
    $pageOverview.Visible = ($navKey -eq 'nav_overview')
    $pageDeploy.Visible   = ($navKey -eq 'nav_deploy')
    $pageSettings.Visible = ($navKey -eq 'nav_settings')
    $pageAbout.Visible    = ($navKey -eq 'nav_about')

    foreach ($nav in $script:navItems) {
        if ($nav.Key -eq $navKey) {
            $nav.Panel.BackColor = $CLR_NAV_ACTIVE
            $nav.Indicator.BackColor = $CLR_MAUVE
            $nav.Label.ForeColor = $CLR_TEXT
        } else {
            $nav.Panel.BackColor = $CLR_SIDEBAR
            $nav.Indicator.BackColor = $CLR_SIDEBAR
            $nav.Label.ForeColor = $CLR_SUBTEXT
        }
    }
    $script:currentNav = $navKey

    if ($navKey -eq 'nav_overview') { Refresh-OverviewPage }
    if ($navKey -eq 'nav_deploy')   { Refresh-WorkspaceList }
    if ($navKey -eq 'nav_about')    { Refresh-AboutPage }
}

# ======================== LANGUAGE SWITCHING ========================
function Apply-Language {
    foreach ($b in $script:tBindings) { $b.C.Text = T $b.K }
    foreach ($nav in $script:navItems) { $nav.Label.Text = T $nav.Key }
    $script:colWs.Text     = T 'dp_ws'
    $script:colStatus.Text = T 'dp_status'
    $script:colLoop.Text   = T 'dp_loop'
    $script:stPathRows.Bundle.Label.Text = T 'st_bundle'
    $script:stPathRows.CC.Label.Text     = T 'st_cc_dir'
    $script:stPathRows.Codex.Label.Text  = T 'st_codex_dir'
    if ($script:currentNav -eq 'nav_overview') { Refresh-OverviewPage }
    if ($script:currentNav -eq 'nav_deploy')   { Refresh-WorkspaceList }
    if ($script:currentNav -eq 'nav_about')    { Refresh-AboutPage }
}

# ======================== INIT ========================
Detect-Versions
Switch-Page 'nav_overview'

[void]$form.ShowDialog()
$form.Dispose()
