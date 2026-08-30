# cc-unlock v8.0.7 GUI - PowerShell WinForms
# Sidebar navigation + version detection + i18n (zh/en)

param([switch]$NoConsole)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { chcp 65001 | Out-Null } catch {}

$UTF8NoBOM = New-Object System.Text.UTF8Encoding $false
$LATIN1 = [System.Text.Encoding]::GetEncoding(28591)

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
    dp_codex_sec  = @{ zh = 'CODEX';       en = 'CODEX' }
    dp_codex_dep  = @{ zh = '部署 Codex'; en = 'Deploy Codex' }
    dp_codex_uni  = @{ zh = '卸载 Codex'; en = 'Uninstall Codex' }
    dp_relay_sec  = @{ zh = 'CODEX 中转站'; en = 'CODEX RELAY' }
    dp_relay_chk  = @{ zh = '使用中转站接入';  en = 'Use Relay Provider' }
    dp_relay_url  = @{ zh = 'API 地址:';     en = 'API URL:' }
    dp_relay_key  = @{ zh = 'API Key:';      en = 'API Key:' }
    dp_relay_mod  = @{ zh = '模型:';         en = 'Model:' }
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
    ab_desc       = @{ zh = '安全研究工作站 — Loop Sec 自递归执行引擎 + 4 套技能框架'; en = 'Security research workstation — Loop Sec self-recursive engine + 4 skill frameworks' }
    ab_feat_title = @{ zh = '功能';     en = 'FEATURES' }
    ab_feat1      = @{ zh = '- 研究员记忆注入 (memory bundle)'; en = '- Researcher memory injection (memory bundle)' }
    ab_feat2      = @{ zh = '- CLAUDE.md 轻量人格 + lab-scope 框架'; en = '- CLAUDE.md lightweight persona + lab-scope framework' }
    ab_feat3      = @{ zh = '- Loop Sec 自递归执行 + 4 技能框架 (loop-sec/android/web/win-reverse)'; en = '- Loop Sec self-recursive + 4 skill frameworks (loop-sec/android/web/win-reverse)' }
    ab_feat4      = @{ zh = '- Codex 系统提示词 + 记忆 + scope confirmation'; en = '- Codex system prompt + memory + scope confirmation' }
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

# Deep-merged settings.json deploy — preserves user's hooks/allow/deny/env.
# Matches deploy.ps1's Deploy-Settings behavior.
$GUI_SETTINGS_ENV_KEYS = @('CLAUDE_CODE_EFFORT_LEVEL', 'DISABLE_AUTOUPDATER')

function Deploy-Settings-Merged {
    $settingsPath = Join-Path $CLAUDE_DIR 'settings.json'
    $settingsSrc = Join-Path $CFG_BUNDLE 'settings.json'
    if (!(Test-Path $settingsSrc)) { LogInfo "source settings.json not found"; return }
    if (!(Test-Path $CLAUDE_DIR)) { New-Item -ItemType Directory -Path $CLAUDE_DIR -Force | Out-Null }

    $srcSettings = $null
    try { $srcSettings = (Get-Content $settingsSrc -Raw -ErrorAction Stop) | ConvertFrom-Json } catch { LogWarn "source settings.json malformed"; return }

    if (!(Test-Path $settingsPath)) {
        if (Copy-Safe $settingsSrc $settingsPath) { LogOk "settings.json (bypassPermissions)" } else { LogFail "settings.json" }
        return
    }

    $existing = $null
    try {
        $raw = [System.IO.File]::ReadAllText($settingsPath, $UTF8NoBOM)
        if ($raw.Trim()) { $existing = $raw | ConvertFrom-Json }
    } catch { LogWarn "existing settings.json malformed, leaving untouched"; return }
    if (!$existing) { $existing = New-Object PSObject }

    $userPerms = $existing.permissions
    if ($userPerms -and ($userPerms.PSObject.Properties.Name -contains 'defaultMode') -and $userPerms.defaultMode -eq 'bypassPermissions') {
        # already ours
    } elseif ($userPerms) {
        $userPerms | Add-Member -NotePropertyName 'defaultMode' -NotePropertyValue 'bypassPermissions' -Force
    } else {
        $existing | Add-Member -NotePropertyName 'permissions' -NotePropertyValue (New-Object PSObject -Property @{ defaultMode = 'bypassPermissions' }) -Force
    }
    $existing | Add-Member -NotePropertyName 'skipDangerousModePermissionPrompt' -NotePropertyValue $true -Force
    if (!($existing.PSObject.Properties.Name -contains 'effortLevel')) {
        $existing | Add-Member -NotePropertyName 'effortLevel' -NotePropertyValue 'xhigh' -Force
    }
    $userEnv = $existing.env
    if (!$userEnv) {
        $userEnv = New-Object PSObject
        $existing | Add-Member -NotePropertyName 'env' -NotePropertyValue $userEnv -Force
    }
    if ($srcSettings.env) {
        foreach ($k in $GUI_SETTINGS_ENV_KEYS) {
            if ($srcSettings.env.PSObject.Properties.Name -contains $k -and !($userEnv.PSObject.Properties.Name -contains $k)) {
                $userEnv | Add-Member -NotePropertyName $k -NotePropertyValue $srcSettings.env.$k -Force
            }
        }
    }
    $json = $existing | ConvertTo-Json -Depth 10
    if (Write-Utf8NoBom $settingsPath $json) { LogOk "settings.json (merged)" } else { LogFail "settings.json" }
}

function Remove-Settings-Surgical {
    $path = Join-Path $CLAUDE_DIR 'settings.json'
    if (!(Test-Path $path)) { return }
    $existing = $null
    try {
        $raw = [System.IO.File]::ReadAllText($path, $UTF8NoBOM)
        if ($raw.Trim()) { $existing = $raw | ConvertFrom-Json }
    } catch { return }
    if (!$existing) { Remove-Item $path -Force -ErrorAction SilentlyContinue; LogOk "Removed empty settings.json"; return }

    $touched = $false
    if ($existing.permissions -and ($existing.permissions.PSObject.Properties.Name -contains 'defaultMode') -and $existing.permissions.defaultMode -eq 'bypassPermissions') {
        $existing.permissions.PSObject.Properties.Remove('defaultMode'); $touched = $true
        if ($existing.permissions.PSObject.Properties.Name.Count -eq 0) { $existing.PSObject.Properties.Remove('permissions') }
    }
    if ($existing.PSObject.Properties.Name -contains 'skipDangerousModePermissionPrompt') {
        $existing.PSObject.Properties.Remove('skipDangerousModePermissionPrompt'); $touched = $true
    }
    if ($existing.PSObject.Properties.Name -contains 'effortLevel' -and $existing.effortLevel -eq 'xhigh') {
        $existing.PSObject.Properties.Remove('effortLevel'); $touched = $true
    }
    if ($existing.env) {
        foreach ($k in $GUI_SETTINGS_ENV_KEYS) {
            if ($existing.env.PSObject.Properties.Name -contains $k) { $existing.env.PSObject.Properties.Remove($k); $touched = $true }
        }
        if ($existing.env.PSObject.Properties.Name.Count -eq 0) { $existing.PSObject.Properties.Remove('env') }
    }
    if (!$touched) { return }
    if ($existing.PSObject.Properties.Name.Count -eq 0) {
        Remove-Item $path -Force -ErrorAction SilentlyContinue; LogOk "Removed settings.json (was cc-unlock only)"
    } else {
        $json = $existing | ConvertTo-Json -Depth 10
        if (Write-Utf8NoBom $path $json) { LogOk "settings.json (stripped cc-unlock keys)" }
    }
}

function Get-MemoryDir([string]$ProjectName) { return Join-Path $CLAUDE_PROJECTS "$ProjectName\memory" }

# UTF-8 (BOM-tolerant) line read. Bare Get-Content reads with the system ANSI codepage
# (e.g. cp936) and corrupts non-ASCII bytes — CJK project paths in config.toml — on the
# read/rewrite round-trip. Reading as UTF-8 preserves them.
function Set-InstructionsFile($ConfigPath) {
    $line = 'model_instructions_file = "system-prompt.md"'
    if (!(Test-Path $ConfigPath)) { return (Write-Utf8NoBom $ConfigPath ($line + "`n")) }
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
    $hasContent = ($kept | Where-Object { $_ -match '\S' }).Count -gt 0
    if ($hasContent) {
        $content = ($kept -join "`n"); if (!$content.EndsWith("`n")) { $content += "`n" }
        [System.IO.File]::WriteAllBytes($ConfigPath, $LATIN1.GetBytes($content)); return 'kept'
    }
    Remove-Item $ConfigPath -Force -ErrorAction SilentlyContinue; return 'removed'
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

function Resolve-WorkspacePath([string]$projName) {
    # Fast path: 简单反解(不含空格路径直接命中)
    $possiblePath = ($projName -replace '^([A-Za-z])-', '$1:\') -replace '-', '\'
    if (Test-Path $possiblePath) { return $possiblePath }
    # Fallback: 从该 workspace 的任意 session JSONL 里读 "cwd" 字段
    # (Claude Code workspace 名字将路径里的空格编码为 '-',反解时不可逆;
    #  session JSONL 第 3 行往后有 "cwd":"..." 字段带真实路径)
    $wsDir = Join-Path $CLAUDE_PROJECTS $projName
    if (Test-Path $wsDir) {
        $jsonl = Get-ChildItem -Path $wsDir -Filter '*.jsonl' -File -ErrorAction SilentlyContinue |
                 Select-Object -First 1
        if ($jsonl) {
            try {
                $lines = Get-Content $jsonl.FullName -TotalCount 10 -ErrorAction Stop
                foreach ($line in $lines) {
                    if ($line -match '"cwd":"([^"]+)"') {
                        $cwd = $matches[1] -replace '\\\\', '\'
                        if (Test-Path $cwd) { return $cwd }
                    }
                }
            } catch {}
        }
    }
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
function Deploy-ToWorkspace([string]$ProjectName, [string]$WorkspacePath) {
    $memDir = Get-MemoryDir $ProjectName
    if (!(Test-Path $memDir)) { New-Item -ItemType Directory -Path $memDir -Force | Out-Null }
    LogHeader "Claude Code: $ProjectName"
    # Deploy every *.md memory file (except CLAUDE.md and MEMORY.md handled separately)
    $bundleFiles = @(Get-ChildItem $MEM_BUNDLE -Filter '*.md' -File | Where-Object { $_.Name -ne 'MEMORY.md' -and $_.Name -ne 'CLAUDE.md' })
    $memOk = 0
    foreach ($f in $bundleFiles) {
        $dst = Join-Path $memDir $f.Name
        if (Copy-Safe $f.FullName $dst) { $memOk++ } else { LogFail $f.Name }
    }
    LogOk "$memOk memory files deployed"
    # MEMORY.md index — overwrite
    $indexSrc = Join-Path $MEM_BUNDLE 'MEMORY.md'
    $indexPath = Join-Path $memDir 'MEMORY.md'
    if ((Test-Path $indexSrc) -and (Copy-Safe $indexSrc $indexPath)) { LogOk "MEMORY.md (overwrote index)" } else { LogFail "MEMORY.md" }
    if ($WorkspacePath -and (Test-Path $WorkspacePath)) {
        $cSrc = Join-Path $MEM_BUNDLE 'CLAUDE.md'
        $cDst = Join-Path $WorkspacePath 'CLAUDE.md'
        if ((Test-Path $cSrc) -and (Copy-Safe $cSrc $cDst)) { LogOk "CLAUDE.md -> workspace" } else { LogFail "CLAUDE.md" }
    }
    if ($WorkspacePath -and (Test-Path $WorkspacePath)) {
        $skillDir = Join-Path $WorkspacePath '.claude\skills'
        if (!(Test-Path $skillDir)) { New-Item -ItemType Directory -Path $skillDir -Force | Out-Null }
        foreach ($sd in @('loop-sec', 'android-reverse', 'web-reverse', 'win-reverse')) {
            $sdSrc = Join-Path $SKILL_BUNDLE $sd
            if (Test-Path $sdSrc) {
                $sdDst = Join-Path $skillDir $sd
                try {
                    if (Test-Path $sdDst) { Remove-Item $sdDst -Recurse -Force -ErrorAction SilentlyContinue }
                    Copy-Item $sdSrc $sdDst -Recurse -Force -ErrorAction Stop
                    $count = @(Get-ChildItem $sdDst -Recurse -File -ErrorAction SilentlyContinue).Count
                    LogOk "$sd ($count files) -> .claude/skills/"
                } catch { LogFail "$sd" }
            }
        }
    }
    Deploy-Settings-Merged
    foreach ($f in @('CLAUDE.md', 'system-prompt.md')) {
        $p = Join-Path $CLAUDE_DIR $f
        if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue; LogInfo "Cleaned legacy $f from ~/.claude/" }
    }
}

function Uninstall-FromWorkspace([string]$ProjectName, [string]$WorkspacePath) {
    $memDir = Get-MemoryDir $ProjectName
    LogHeader "Removing: $ProjectName"
    # Remove every *.md we own (by matching bundle filenames)
    $bundleFiles = @(Get-ChildItem $MEM_BUNDLE -Filter '*.md' -File | Where-Object { $_.Name -ne 'CLAUDE.md' })
    $removed = 0
    foreach ($f in $bundleFiles) {
        $p = Join-Path $memDir $f.Name
        if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue; $removed++ }
    }
    LogOk "Removed $removed memory files (incl. MEMORY.md)"
    if ($WorkspacePath -and (Test-Path $WorkspacePath)) {
        $claudePath = Join-Path $WorkspacePath 'CLAUDE.md'
        if (Test-Path $claudePath) { Remove-Item $claudePath -Force -ErrorAction SilentlyContinue; LogOk "Removed CLAUDE.md" }
        $skillDir = Join-Path $WorkspacePath '.claude\skills'
        foreach ($sd in @('loop-sec', 'android-reverse', 'web-reverse', 'win-reverse')) {
            $sdPath = Join-Path $skillDir $sd
            if (Test-Path $sdPath) { Remove-Item $sdPath -Recurse -Force -ErrorAction SilentlyContinue; LogOk "Removed $sd" }
        }
        if ((Test-Path $skillDir) -and (@(Get-ChildItem $skillDir -ErrorAction SilentlyContinue).Count -eq 0)) { Remove-Item $skillDir -Force -ErrorAction SilentlyContinue }
    }
    Remove-Settings-Surgical
}

function Deploy-CodexMemory {
    $memBundlePath = Join-Path $SCRIPT_DIR 'codex-files\codex-memory-bundle'
    if (!(Test-Path $memBundlePath)) { LogInfo "Codex memory bundle not found"; return }
    LogHeader "Codex Memory"
    $memDir = Join-Path $CODEX_DIR 'memories'
    if (!(Test-Path $memDir)) { New-Item -ItemType Directory -Path $memDir -Force | Out-Null }
    foreach ($f in @('memory_summary.md', 'MEMORY.md', 'raw_memories.md')) {
        $src = Join-Path $memBundlePath $f
        if (Test-Path $src) {
            $dst = Join-Path $memDir $f
            if (Copy-Safe $src $dst) { $sz = (Get-Item $dst).Length; LogOk "$f ($sz bytes)" } else { LogFail $f }
        }
    }
    Deploy-CodexRollout
}

function Deploy-CodexRollout {
    $rolloutBundlePath = Join-Path $SCRIPT_DIR 'codex-files\codex-rollout-bundle\rollout_summaries'
    if (!(Test-Path $rolloutBundlePath)) { LogInfo "Codex rollout bundle not found"; return }
    LogHeader "Codex Rollout Summaries"
    $srcFiles = @(Get-ChildItem $rolloutBundlePath -Filter '*.md' -File)
    if ($srcFiles.Count -eq 0) {
        LogInfo "Rollout bundle empty — refusing to wipe target"
        return
    }
    $rolloutDir = Join-Path $CODEX_DIR 'memories\rollout_summaries'
    if (!(Test-Path $rolloutDir)) {
        New-Item -ItemType Directory -Path $rolloutDir -Force | Out-Null
    } else {
        Get-ChildItem $rolloutDir -Filter '*.md' -File | Remove-Item -Force -ErrorAction SilentlyContinue
    }
    $currentUser = if ($env:USERNAME) { $env:USERNAME } else { 'user' }
    $count = 0
    foreach ($f in $srcFiles) {
        $content = $null
        try { $content = [System.IO.File]::ReadAllText($f.FullName, $UTF8NoBOM) } catch { continue }
        if (!$content) { continue }
        # Literal string replace (NOT regex) so special chars in username don't corrupt output
        $content = $content.Replace('<USER>', $currentUser)
        $dst = Join-Path $rolloutDir $f.Name
        if (Write-Utf8NoBom $dst $content) { $count++ }
    }
    if ($count -gt 0) {
        LogOk "$count rollout summaries seeded (USERNAME=$currentUser)"
    } else {
        LogFail "0 rollout summaries seeded"
    }
}

function Uninstall-CodexMemory {
    $memDir = Join-Path $CODEX_DIR 'memories'
    if (!(Test-Path $memDir)) { return }
    LogHeader "Codex Memory"
    foreach ($f in @('memory_summary.md', 'MEMORY.md', 'raw_memories.md')) {
        $p = Join-Path $memDir $f
        if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue; LogOk "Removed $f" }
    }
    Uninstall-CodexRollout
}

function Uninstall-CodexRollout {
    $rolloutDir = Join-Path $CODEX_DIR 'memories\rollout_summaries'
    if (!(Test-Path $rolloutDir)) { return }
    LogHeader "Codex Rollout Summaries"
    $removed = 0
    Get-ChildItem $rolloutDir -Filter '*.md' -File | ForEach-Object {
        $content = ''
        try { $content = [System.IO.File]::ReadAllText($_.FullName, $UTF8NoBOM) } catch {}
        if ($content -match 'cwd:\s*\\\\\?\\C:\\Workspace\\') {
            Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
            $removed++
        }
    }
    LogOk "Removed $removed seeded rollout summaries"
}

function Deploy-CodexConfig {
    if (!(Test-Path $CODEX_BUNDLE)) { LogInfo "Codex bundle not found"; return }
    LogHeader "Codex"
    if (!(Test-Path $CODEX_DIR)) { New-Item -ItemType Directory -Path $CODEX_DIR -Force | Out-Null }
    # AGENTS.md — 主人格载体,叠加在 Codex 内置 base 之上(不替换,不卡 startup)
    $agentsSrc = Join-Path $CODEX_BUNDLE 'AGENTS.md'
    if (Test-Path $agentsSrc) {
        $adst = Join-Path $CODEX_DIR 'AGENTS.md'
        if (Copy-Safe $agentsSrc $adst) { $sz = (Get-Item $adst).Length; LogOk "AGENTS.md ($sz bytes) - persona" } else { LogFail "AGENTS.md" }
    }
    # config.toml — 移除 model_instructions_file(会替换 base prompt 卡死桌面版),保留其它键
    $cfg = Join-Path $CODEX_DIR 'config.toml'
    switch (Remove-InstructionsFile $cfg) {
        'removed' { LogOk "config.toml - removed model_instructions_file" }
        'kept'    { LogOk "config.toml - base prompt intact" }
        default   { LogInfo "config.toml - base prompt intact" }
    }
    $legacySp = Join-Path $CODEX_DIR 'system-prompt.md'
    if (Test-Path $legacySp) { Remove-Item $legacySp -Force -ErrorAction SilentlyContinue; LogInfo "cleaned legacy system-prompt.md" }
    if ($script:chkRelay -and $script:chkRelay.Checked -and $script:txtRelayUrl.Text) {
        Deploy-RelayProvider $cfg $script:txtRelayUrl.Text $script:txtRelayKey.Text $script:txtRelayModel.Text
        LogOk "Relay provider configured: $($script:txtRelayUrl.Text)"
    }
    Deploy-CodexSkills
    Deploy-CodexMemory
}

function Deploy-CodexSkills {
    LogHeader "Codex Skills"
    $codexSkillDir = Join-Path $CODEX_DIR 'skills'
    if (!(Test-Path $codexSkillDir)) { New-Item -ItemType Directory -Path $codexSkillDir -Force | Out-Null }
    foreach ($sd in @('loop-sec', 'android-reverse', 'web-reverse', 'win-reverse')) {
        $sdSrc = Join-Path $SKILL_BUNDLE $sd
        if (Test-Path $sdSrc) {
            $sdDst = Join-Path $codexSkillDir $sd
            try {
                if (Test-Path $sdDst) { Remove-Item $sdDst -Recurse -Force -ErrorAction SilentlyContinue }
                Copy-Item $sdSrc $sdDst -Recurse -Force -ErrorAction Stop
                $count = @(Get-ChildItem $sdDst -Recurse -File -ErrorAction SilentlyContinue).Count
                LogOk "$sd ($count files) -> .codex/skills/"
            } catch { LogFail "$sd" }
        }
    }
}

function Uninstall-CodexConfig {
    if (!(Test-Path $CODEX_DIR)) { return }
    LogHeader "Codex"
    foreach ($f in @('system-prompt.md', 'AGENTS.md')) {
        $p = Join-Path $CODEX_DIR $f
        if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue; LogOk "Removed $f" }
    }
    $cfgPath = Join-Path $CODEX_DIR 'config.toml'
    Remove-RelayProvider $cfgPath
    switch (Remove-InstructionsFile $cfgPath) {
        'removed' { LogOk "Removed config.toml" }
        'kept'    { LogInfo "config.toml (kept other settings)" }
    }
    Uninstall-CodexSkills
    Uninstall-CodexMemory
}

function Uninstall-CodexSkills {
    $codexSkillDir = Join-Path $CODEX_DIR 'skills'
    if (!(Test-Path $codexSkillDir)) { return }
    LogHeader "Codex Skills"
    foreach ($sd in @('loop-sec', 'android-reverse', 'web-reverse', 'win-reverse')) {
        $sdPath = Join-Path $codexSkillDir $sd
        if (Test-Path $sdPath) { Remove-Item $sdPath -Recurse -Force -ErrorAction SilentlyContinue; LogOk "Removed .codex/skills/$sd/" }
    }
}

function Verify-Workspace([string]$ProjectName, [string]$WorkspacePath) {
    $memDir = Get-MemoryDir $ProjectName
    LogHeader "Verify: $ProjectName"
    $bundleFiles = @(Get-ChildItem $MEM_BUNDLE -Filter '*.md' -File | Where-Object { $_.Name -ne 'MEMORY.md' -and $_.Name -ne 'CLAUDE.md' })
    $deployed = 0
    foreach ($f in $bundleFiles) {
        if (Test-Path (Join-Path $memDir $f.Name)) { $deployed++ }
    }
    if ($deployed -eq $bundleFiles.Count -and $deployed -gt 0) {
        LogOk "memory files: $deployed/$($bundleFiles.Count)"
    } elseif ($deployed -gt 0) {
        LogWarn "memory files: $deployed/$($bundleFiles.Count) (partial)"
    } else {
        LogFail "memory files MISSING"
    }
    $indexPath = Join-Path $memDir 'MEMORY.md'
    if (Test-Path $indexPath) {
        LogOk "MEMORY.md"
    } else { LogFail "MEMORY.md MISSING" }
    if ($WorkspacePath -and (Test-Path $WorkspacePath)) {
        $cp = Join-Path $WorkspacePath 'CLAUDE.md'
        if (Test-Path $cp) {
            $sz = (Get-Item $cp).Length
            $c = Get-Content $cp -Raw -ErrorAction SilentlyContinue
            $loop = if ($c -match 'loop-sec|Loop Engineering') { '+ Loop Sec' } else { '' }
            LogOk "CLAUDE.md ($sz bytes) $loop"
        } else { LogWarn "CLAUDE.md not found" }
        foreach ($sd in @('loop-sec', 'android-reverse', 'web-reverse', 'win-reverse')) {
            $sdPath = Join-Path $WorkspacePath ".claude\skills\$sd"
            if (Test-Path $sdPath) {
                $count = @(Get-ChildItem $sdPath -Recurse -File -ErrorAction SilentlyContinue).Count
                LogOk "$sd ($count files)"
            } else { LogInfo "$sd not deployed" }
        }
    }
}

# === Get Workspaces ===
function Get-Workspaces {
    $result = @()
    if (!(Test-Path $CLAUDE_PROJECTS)) { return $result }
    foreach ($d in (Get-ChildItem $CLAUDE_PROJECTS -Directory -ErrorAction SilentlyContinue)) {
        $memDir = Get-MemoryDir $d.Name
        # v8.0.7 sentinel(learner-profile.md) 或 legacy sentinels 都视为已部署
        $deployed = (Test-Path (Join-Path $memDir 'learner-profile.md')) -or `
                    (Test-Path (Join-Path $memDir 'engineer-profile.md')) -or `
                    (Test-Path (Join-Path $memDir 'security-research-lab.md'))
        # 反解 workspace 到真实项目路径,读 CLAUDE.md,检查 Loop Engineering
        $hasLoop = $false
        $projPath = Resolve-WorkspacePath $d.Name
        if ($projPath -and (Test-Path $projPath)) {
            $cp = Join-Path $projPath 'CLAUDE.md'
            if (Test-Path $cp) {
                try {
                    $c = Get-Content $cp -Raw -ErrorAction Stop
                    if ($c -match 'loop-sec|Loop Engineering') { $hasLoop = $true }
                } catch {}
            }
        }
        $result += [PSCustomObject]@{ Name = $d.Name; Deployed = $deployed; HasLoop = $hasLoop; Path = $projPath }
    }
    return $result
}

# ================================================================
#                         BUILD GUI
# ================================================================

$form = New-Object System.Windows.Forms.Form
$form.Text = 'cc-unlock v8.0.7 - Security Research Workstation'
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
$lblSideVer.Text = 'v8.0.7'
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
$ovTitle.Text = 'cc-unlock v8.0.7'
$ovTitle.Font = New-Object System.Drawing.Font($fontFamily, 18, [System.Drawing.FontStyle]::Bold)
$ovTitle.ForeColor = $CLR_MAUVE
$ovTitle.Location = New-Object System.Drawing.Point(25, 18)
$ovTitle.AutoSize = $true
$pageOverview.Controls.Add($ovTitle)

$ovSub = New-Object System.Windows.Forms.Label
$ovSub.Text = 'Security Research Workstation'
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
$pageDeploy.AutoScroll = $true
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

# DP: Claude Code section label
$dpLblCC = New-Object System.Windows.Forms.Label
$dpLblCC.Text = 'CLAUDE CODE'
$dpLblCC.Font = $fSection
$dpLblCC.ForeColor = $CLR_SUBTEXT
$dpLblCC.Location = New-Object System.Drawing.Point(25, 258)
$dpLblCC.AutoSize = $true
$pageDeploy.Controls.Add($dpLblCC)

$btnY = 278
$btnDeploySel  = New-ActionButton 'dp_deploy_sel'  25  $btnY 120 $CLR_BTN_GREEN
$btnDeployAll  = New-ActionButton 'dp_deploy_all'  153 $btnY 110 $CLR_BTN_GREEN
$btnUninstSel  = New-ActionButton 'dp_uninst_sel'  271 $btnY 120 $CLR_BTN_RED
$btnUninstAll  = New-ActionButton 'dp_uninst_all'  399 $btnY 110 $CLR_BTN_RED
$btnVerify     = New-ActionButton 'dp_verify'      517 $btnY 75  $CLR_BTN
$btnRefresh    = New-ActionButton 'dp_refresh'     600 $btnY 70  $CLR_BTN

# DP: Codex Section (independent)
$dpLblCodex = New-Object System.Windows.Forms.Label
$dpLblCodex.Font = $fSection
$dpLblCodex.ForeColor = $CLR_SUBTEXT
$dpLblCodex.Location = New-Object System.Drawing.Point(25, 318)
$dpLblCodex.AutoSize = $true
$pageDeploy.Controls.Add($dpLblCodex)
Bind-T $dpLblCodex 'dp_codex_sec'

$btnCodexDeploy = New-ActionButton 'dp_codex_dep' 25  338 120 $CLR_BTN_GREEN
$btnCodexUninst = New-ActionButton 'dp_codex_uni' 153 338 120 $CLR_BTN_RED

# DP: Relay Section
$dpLblRelay = New-Object System.Windows.Forms.Label
$dpLblRelay.Font = $fSection
$dpLblRelay.ForeColor = $CLR_SUBTEXT
$dpLblRelay.Location = New-Object System.Drawing.Point(25, 378)
$dpLblRelay.AutoSize = $true
$pageDeploy.Controls.Add($dpLblRelay)
Bind-T $dpLblRelay 'dp_relay_sec'

$script:chkRelay = New-Object System.Windows.Forms.CheckBox
$script:chkRelay.Font = $fBody
$script:chkRelay.ForeColor = $CLR_TEXT
$script:chkRelay.Location = New-Object System.Drawing.Point(25, 398)
$script:chkRelay.AutoSize = $true
$pageDeploy.Controls.Add($script:chkRelay)
Bind-T $script:chkRelay 'dp_relay_chk'

$dpLblRelayUrl = New-Object System.Windows.Forms.Label
$dpLblRelayUrl.Font = $fBody
$dpLblRelayUrl.ForeColor = $CLR_SUBTEXT
$dpLblRelayUrl.Location = New-Object System.Drawing.Point(25, 425)
$dpLblRelayUrl.AutoSize = $true
$pageDeploy.Controls.Add($dpLblRelayUrl)
Bind-T $dpLblRelayUrl 'dp_relay_url'

$script:txtRelayUrl = New-Object System.Windows.Forms.TextBox
$script:txtRelayUrl.Font = $fMono
$script:txtRelayUrl.BackColor = $CLR_SURFACE
$script:txtRelayUrl.ForeColor = $CLR_TEXT
$script:txtRelayUrl.BorderStyle = 'FixedSingle'
$script:txtRelayUrl.Location = New-Object System.Drawing.Point(110, 422)
$script:txtRelayUrl.Size = New-Object System.Drawing.Size(560, 24)
$pageDeploy.Controls.Add($script:txtRelayUrl)

$dpLblRelayKey = New-Object System.Windows.Forms.Label
$dpLblRelayKey.Font = $fBody
$dpLblRelayKey.ForeColor = $CLR_SUBTEXT
$dpLblRelayKey.Location = New-Object System.Drawing.Point(25, 452)
$dpLblRelayKey.AutoSize = $true
$pageDeploy.Controls.Add($dpLblRelayKey)
Bind-T $dpLblRelayKey 'dp_relay_key'

$script:txtRelayKey = New-Object System.Windows.Forms.TextBox
$script:txtRelayKey.Font = $fMono
$script:txtRelayKey.BackColor = $CLR_SURFACE
$script:txtRelayKey.ForeColor = $CLR_TEXT
$script:txtRelayKey.BorderStyle = 'FixedSingle'
$script:txtRelayKey.UseSystemPasswordChar = $true
$script:txtRelayKey.Location = New-Object System.Drawing.Point(110, 449)
$script:txtRelayKey.Size = New-Object System.Drawing.Size(560, 24)
$pageDeploy.Controls.Add($script:txtRelayKey)

$dpLblRelayModel = New-Object System.Windows.Forms.Label
$dpLblRelayModel.Font = $fBody
$dpLblRelayModel.ForeColor = $CLR_SUBTEXT
$dpLblRelayModel.Location = New-Object System.Drawing.Point(25, 479)
$dpLblRelayModel.AutoSize = $true
$pageDeploy.Controls.Add($dpLblRelayModel)
Bind-T $dpLblRelayModel 'dp_relay_mod'

$script:txtRelayModel = New-Object System.Windows.Forms.TextBox
$script:txtRelayModel.Font = $fMono
$script:txtRelayModel.BackColor = $CLR_SURFACE
$script:txtRelayModel.ForeColor = $CLR_TEXT
$script:txtRelayModel.BorderStyle = 'FixedSingle'
$script:txtRelayModel.Location = New-Object System.Drawing.Point(110, 476)
$script:txtRelayModel.Size = New-Object System.Drawing.Size(560, 24)
$pageDeploy.Controls.Add($script:txtRelayModel)

$script:chkRelay.Add_CheckedChanged({
    $enabled = $script:chkRelay.Checked
    $script:txtRelayUrl.Enabled = $enabled
    $script:txtRelayKey.Enabled = $enabled
    $script:txtRelayModel.Enabled = $enabled
})
$script:txtRelayUrl.Enabled = $false
$script:txtRelayKey.Enabled = $false
$script:txtRelayModel.Enabled = $false

# DP: Log
$dpLblLog = New-Object System.Windows.Forms.Label
$dpLblLog.Font = $fSection
$dpLblLog.ForeColor = $CLR_SUBTEXT
$dpLblLog.Location = New-Object System.Drawing.Point(25, 508)
$dpLblLog.AutoSize = $true
$pageDeploy.Controls.Add($dpLblLog)
Bind-T $dpLblLog 'dp_log'

$logBox = New-Object System.Windows.Forms.RichTextBox
$logBox.Location = New-Object System.Drawing.Point(25, 528)
$logBox.Size = New-Object System.Drawing.Size(645, 165)
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
        Deploy-ToWorkspace $projName $txtPath.Text
        Log ("`r`n" + (T 'dp_done')) $CLR_MAUVE
        Refresh-WorkspaceList; return
    }
    $checked = @($listView.CheckedItems)
    if ($checked.Count -eq 0) { LogWarn (T 'dp_no_sel'); return }
    foreach ($item in $checked) {
        $wsPath = Resolve-WorkspacePath $item.Text
        Deploy-ToWorkspace $item.Text $wsPath
    }
    Log ("`r`n" + (T 'dp_done')) $CLR_MAUVE
    Refresh-WorkspaceList
})

$btnDeployAll.Add_Click({
    $logBox.Clear()
    $count = 0
    foreach ($item in $listView.Items) {
        $wsPath = Resolve-WorkspacePath $item.Text
        Deploy-ToWorkspace $item.Text $wsPath
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
        $agp = Join-Path $CODEX_DIR 'AGENTS.md'
        if (Test-Path $agp) {
            $sz = (Get-Item $agp).Length
            $ct = Get-Content $agp -Raw -ErrorAction SilentlyContinue
            if ($ct -match 'loop-sec|cc-unlock|安全研究') { LogOk "AGENTS.md ($sz bytes) - persona" } else { LogWarn "AGENTS.md - content mismatch" }
        } else { LogFail "AGENTS.md MISSING" }
        # config.toml 应 NOT 含 model_instructions_file(否则替换 base prompt 卡死 startup)
        $cfgp = Join-Path $CODEX_DIR 'config.toml'
        if (Test-Path $cfgp) {
            $ct = Get-Content $cfgp -Raw -ErrorAction SilentlyContinue
            if ($ct -match 'model_instructions_file') { LogWarn "config.toml - 含 model_instructions_file(应移除,会卡 startup)" } else { LogOk "config.toml - base prompt intact" }
        }
    }
})

$btnRefresh.Add_Click({ $logBox.Clear(); Refresh-WorkspaceList; LogInfo (T 'dp_refreshed') })

# DP: Codex Button Handlers
$btnCodexDeploy.Add_Click({
    $logBox.Clear()
    Deploy-CodexConfig
    Log ("`r`n" + (T 'dp_done')) $CLR_MAUVE
})

$btnCodexUninst.Add_Click({
    $logBox.Clear()
    Uninstall-CodexConfig
    Log ("`r`n" + (T 'dp_done')) $CLR_MAUVE
})

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
$abRowVer.Value.Text = '8.0.7'
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
