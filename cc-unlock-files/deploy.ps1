# cc-unlock Deploy v1.0
# Security Research Workstation Config Deployer
# Compatible: Windows 7/8/10/11, PowerShell 2.0-7.x, Core/Desktop

param(
    [switch]$Uninstall,
    [switch]$Verify,
    [switch]$Restore,
    [switch]$SkipSettings
)

$ProgressPreference = 'SilentlyContinue'

# --- UTF-8 ---
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { [Console]::InputEncoding  = [System.Text.Encoding]::UTF8 } catch {}
try { $OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { chcp 65001 | Out-Null } catch {}

# --- Environment Detection ---
$PS_FLAVOR = 'Desktop'
$PS_VER    = '2.0'
try {
    if ($PSVersionTable.PSEdition -eq 'Core') { $PS_FLAVOR = 'Core' }
    $PS_VER = "$($PSVersionTable.PSVersion.Major).$($PSVersionTable.PSVersion.Minor)"
} catch {}

$OS_VER   = 'Unknown'
$OS_BUILD = 0
try {
    $os = [System.Environment]::OSVersion.Version
    $OS_VER   = "$($os.Major).$($os.Minor)"
    $OS_BUILD = $os.Build
} catch {}

$IS_ADMIN = $false
try {
    $identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    $IS_ADMIN  = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
} catch {}

# --- User Home ---
$USER_HOME = $env:USERPROFILE
if (!$USER_HOME) {
    try { $USER_HOME = [Environment]::GetFolderPath('UserProfile') } catch {}
    if (!$USER_HOME) {
        foreach ($drive in @('C', 'D', 'E')) {
            $testPath = "${drive}:\Users\$env:USERNAME"
            if (Test-Path $testPath) { $USER_HOME = $testPath; break }
        }
        if (!$USER_HOME) { $USER_HOME = "C:\Users\$env:USERNAME" }
    }
}

# --- Target Directories ---
$CLAUDE_DIR = Join-Path $USER_HOME '.claude'
$ALL_DIRS   = @($CLAUDE_DIR)

$desktopCandidates = @(
    (Join-Path $env:APPDATA 'claude'),
    (Join-Path $env:APPDATA 'Claude'),
    (Join-Path $env:APPDATA 'Claude-3p'),
    (Join-Path $env:LOCALAPPDATA 'claude-code'),
    (Join-Path $env:LOCALAPPDATA 'claude'),
    (Join-Path $env:LOCALAPPDATA 'Claude'),
    (Join-Path $env:LOCALAPPDATA 'Claude-3p'),
    (Join-Path $USER_HOME 'AppData\Roaming\claude'),
    (Join-Path $USER_HOME 'AppData\Roaming\Claude'),
    (Join-Path $USER_HOME 'AppData\Roaming\Claude-3p'),
    (Join-Path $USER_HOME 'AppData\Local\claude-code'),
    (Join-Path $USER_HOME 'AppData\Local\claude'),
    (Join-Path $USER_HOME 'AppData\Local\Claude'),
    (Join-Path $USER_HOME 'AppData\Local\Claude-3p')
)
foreach ($c in $desktopCandidates) {
    if ($c -ne $CLAUDE_DIR -and (Test-Path $c)) { $ALL_DIRS += $c }
}

# --- Source Directory ---
$SCRIPT_DIR = $PSScriptRoot
if (!$SCRIPT_DIR) {
    try { $SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path } catch {}
    if (!$SCRIPT_DIR) { $SCRIPT_DIR = (Get-Location).Path }
}
$BUNDLE_DIR = Join-Path $SCRIPT_DIR 'config-bundle'
$CODEX_BUNDLE_DIR = Join-Path $SCRIPT_DIR '..\codex-files\codex-config-bundle'
$CODEX_DIR = Join-Path $USER_HOME '.codex'

# --- Helper Functions ---

function Write-Utf8NoBom($Path, $Content) {
    try {
        $utf8 = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($Path, $Content, $utf8)
        return $true
    } catch {}
    try {
        $Content | Out-File -FilePath $Path -Encoding UTF8 -Force -ErrorAction Stop
        return $true
    } catch {}
    return $false
}

function Copy-Safe($Src, $Dst, $Retries = 3) {
    for ($i = 0; $i -lt $Retries; $i++) {
        try {
            Copy-Item $Src $Dst -Force -ErrorAction Stop
            return $true
        } catch {
            if ($i -lt ($Retries - 1)) { Start-Sleep -Milliseconds (500 * ($i + 1)) }
        }
    }
    return $false
}

function New-DirSafe($Path) {
    if (Test-Path $Path) { return $true }
    try {
        New-Item -ItemType Directory -Path $Path -Force -ErrorAction Stop | Out-Null
        return $true
    } catch {}
    try {
        & cmd /c "mkdir `"$Path`"" 2>$null
        return (Test-Path $Path)
    } catch {}
    return $false
}

function Remove-Safe($Path) {
    if (!(Test-Path $Path)) { return $true }
    try { Remove-Item $Path -Force -ErrorAction Stop; return $true } catch {}
    try { & cmd /c "del /f `"$Path`"" 2>$null; return !(Test-Path $Path) } catch {}
    return $false
}

function Test-Writable($Path) {
    if (!(Test-Path $Path)) { return $true }
    try {
        $item = Get-Item $Path -ErrorAction Stop
        if ($item.IsReadOnly) { $item.IsReadOnly = $false }
        return $true
    } catch {}
    return $false
}

function Test-Locked($Path) {
    if (!(Test-Path $Path)) { return $false }
    try {
        $s = [System.IO.File]::Open($Path, 'Open', 'ReadWrite', 'None')
        $s.Close()
        return $false
    } catch { return $true }
}

function Test-DiskSpace($Path, $MinMB = 10) {
    try {
        $drive = Split-Path -Qualifier $Path -ErrorAction Stop
        if ($drive) {
            $disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='$drive'" -ErrorAction Stop
            return ($disk.FreeSpace -gt ($MinMB * 1MB))
        }
    } catch {}
    return $true
}

# --- Backup ---
function Backup-Config($Dir) {
    $date      = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backupDir = Join-Path $Dir "backups\cc-unlock-$date"
    $files     = @('CLAUDE.md', 'system-prompt.md', 'config.toml', 'settings.json')
    $count     = 0
    foreach ($f in $files) {
        $src = Join-Path $Dir $f
        if (Test-Path $src) {
            New-DirSafe $backupDir | Out-Null
            if (Copy-Safe $src (Join-Path $backupDir $f)) { $count++ }
        }
    }
    return $count
}

# --- Restore ---
function Restore-Config($Dir) {
    $backupBase = Join-Path $Dir 'backups'
    if (!(Test-Path $backupBase)) {
        Write-Host '  No backups found' -ForegroundColor DarkGray
        return $false
    }
    $backups = @()
    try { $backups = Get-ChildItem $backupBase -Directory -ErrorAction Stop | Sort-Object Name -Descending } catch {}
    if ($backups.Count -eq 0) {
        Write-Host '  No backups found' -ForegroundColor DarkGray
        return $false
    }
    $latest = $backups[0].FullName
    Write-Host "  Restoring from: $($backups[0].Name)" -ForegroundColor Yellow
    $files    = @('CLAUDE.md', 'system-prompt.md', 'config.toml', 'settings.json')
    $restored = 0
    foreach ($f in $files) {
        $src = Join-Path $latest $f
        if (Test-Path $src) {
            if (Copy-Safe $src (Join-Path $Dir $f)) {
                Write-Host "    Restored $f" -ForegroundColor Green
                $restored++
            }
        }
    }
    return $restored -gt 0
}

# --- Deploy ---
function Deploy-Config($Dst, $Src) {
    $ok = 0; $fail = 0

    # 1. CLAUDE.md
    Write-Host '[1/4] CLAUDE.md ...' -ForegroundColor Yellow
    $srcFile = Join-Path $Src 'CLAUDE.md'
    if (Test-Path $srcFile) {
        $dstFile = Join-Path $Dst 'CLAUDE.md'
        Test-Writable $dstFile | Out-Null
        if (Copy-Safe $srcFile $dstFile) {
            $sz = (Get-Item $dstFile).Length
            Write-Host "      OK ($sz bytes)" -ForegroundColor Green
            $ok++
        } else {
            Write-Host '      FAIL (locked or permission denied)' -ForegroundColor Red
            $fail++
        }
    } else {
        Write-Host "      NOT FOUND: $srcFile" -ForegroundColor Red
        $fail++
    }

    # 2. system-prompt.md
    Write-Host '[2/4] system-prompt.md ...' -ForegroundColor Yellow
    $srcFile = Join-Path $Src 'system-prompt.md'
    if (Test-Path $srcFile) {
        $dstFile = Join-Path $Dst 'system-prompt.md'
        Test-Writable $dstFile | Out-Null
        if (Copy-Safe $srcFile $dstFile) {
            $sz = (Get-Item $dstFile).Length
            Write-Host "      OK ($sz bytes)" -ForegroundColor Green
            $ok++
        } else {
            Write-Host '      FAIL' -ForegroundColor Red
            $fail++
        }
    } else {
        Write-Host "      NOT FOUND: $srcFile" -ForegroundColor Red
        $fail++
    }

    # 3. settings.json
    Write-Host '[3/4] settings.json ...' -ForegroundColor Yellow
    $settingsPath = Join-Path $Dst 'settings.json'
    if ($SkipSettings) {
        Write-Host '      SKIPPED (--SkipSettings)' -ForegroundColor DarkGray
        $ok++
    } elseif (!(Test-Path $settingsPath)) {
        $json = @"
{
  "effortLevel": "xhigh",
  "env": {
    "CLAUDE_CODE_EFFORT_LEVEL": "max",
    "DISABLE_AUTOUPDATER": "1"
  },
  "permissions": {
    "defaultMode": "bypassPermissions"
  },
  "skipDangerousModePermissionPrompt": true
}
"@
        if (Write-Utf8NoBom $settingsPath $json) {
            Write-Host '      OK (bypassPermissions)' -ForegroundColor Green
            $ok++
        } else {
            Write-Host '      FAIL' -ForegroundColor Red
            $fail++
        }
    } else {
        Write-Host '      SKIPPED (exists)' -ForegroundColor DarkGray
        $ok++
    }

    # 4. config.toml
    Write-Host '[4/4] config.toml ...' -ForegroundColor Yellow
    $configPath = Join-Path $Dst 'config.toml'
    Test-Writable $configPath | Out-Null
    if (Write-Utf8NoBom $configPath 'model_instructions_file = "system-prompt.md"') {
        Write-Host '      OK' -ForegroundColor Green
        $ok++
    } else {
        Write-Host '      FAIL' -ForegroundColor Red
        $fail++
    }

    return @{ Ok = $ok; Fail = $fail }
}

# --- Uninstall ---
function Uninstall-Config($Dir) {
    $files   = @('CLAUDE.md', 'system-prompt.md', 'config.toml')
    $removed = 0
    foreach ($f in $files) {
        $path = Join-Path $Dir $f
        if (Test-Path $path) {
            if (Remove-Safe $path) {
                Write-Host "    Removed $f" -ForegroundColor Green
                $removed++
            } else {
                Write-Host "    Failed to remove $f" -ForegroundColor Red
            }
        } else {
            Write-Host "    $f not found" -ForegroundColor DarkGray
        }
    }
    return $removed
}

# --- Verify ---
function Verify-Config($Dir) {
    $checks = @(
        @{ File = 'CLAUDE.md';        Pattern = 'cc-unlock' },
        @{ File = 'system-prompt.md'; Pattern = 'Security Research' },
        @{ File = 'settings.json';    Pattern = 'bypassPermissions' },
        @{ File = 'config.toml';      Pattern = 'system-prompt.md' }
    )
    $allOk = $true
    foreach ($c in $checks) {
        $path = Join-Path $Dir $c.File
        if (Test-Path $path) {
            $sz = (Get-Item $path).Length
            $content = ''
            try { $content = Get-Content $path -Raw -ErrorAction Stop } catch {}
            if ($content -match $c.Pattern) {
                Write-Host "    $($c.File) - OK ($sz bytes)" -ForegroundColor Green
            } else {
                Write-Host "    $($c.File) - CONTENT MISMATCH ($sz bytes)" -ForegroundColor Yellow
                $allOk = $false
            }
        } else {
            Write-Host "    $($c.File) - MISSING" -ForegroundColor Red
            $allOk = $false
        }
    }
    return $allOk
}

# --- Codex Functions ---

function Backup-Codex($Dir) {
    if (!(Test-Path $Dir)) { return 0 }
    $date      = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backupDir = Join-Path $Dir "backups\cc-unlock-$date"
    $files     = @('AGENTS.md', 'config.toml')
    $count     = 0
    foreach ($f in $files) {
        $src = Join-Path $Dir $f
        if (Test-Path $src) {
            New-DirSafe $backupDir | Out-Null
            if (Copy-Safe $src (Join-Path $backupDir $f)) { $count++ }
        }
    }
    return $count
}

function Deploy-Codex($Dst, $Src) {
    $ok = 0; $fail = 0

    # 1. AGENTS.md
    Write-Host '  [1/2] AGENTS.md ...' -ForegroundColor Yellow
    $srcFile = Join-Path $Src 'AGENTS.md'
    if (Test-Path $srcFile) {
        $dstFile = Join-Path $Dst 'AGENTS.md'
        Test-Writable $dstFile | Out-Null
        if (Copy-Safe $srcFile $dstFile) {
            $sz = (Get-Item $dstFile).Length
            Write-Host "        OK ($sz bytes)" -ForegroundColor Green
            $ok++
        } else {
            Write-Host '        FAIL (locked or permission denied)' -ForegroundColor Red
            $fail++
        }
    } else {
        Write-Host "        NOT FOUND: $srcFile" -ForegroundColor Red
        $fail++
    }

    # 2. config.toml
    Write-Host '  [2/2] config.toml ...' -ForegroundColor Yellow
    $srcFile = Join-Path $Src 'config.toml'
    if (Test-Path $srcFile) {
        $dstFile = Join-Path $Dst 'config.toml'
        Test-Writable $dstFile | Out-Null
        if (Copy-Safe $srcFile $dstFile) {
            $sz = (Get-Item $dstFile).Length
            Write-Host "        OK ($sz bytes)" -ForegroundColor Green
            $ok++
        } else {
            Write-Host '        FAIL' -ForegroundColor Red
            $fail++
        }
    } else {
        Write-Host "        NOT FOUND: $srcFile" -ForegroundColor Red
        $fail++
    }

    return @{ Ok = $ok; Fail = $fail }
}

function Uninstall-Codex($Dir) {
    if (!(Test-Path $Dir)) { return 0 }
    $files   = @('AGENTS.md', 'config.toml')
    $removed = 0
    foreach ($f in $files) {
        $path = Join-Path $Dir $f
        if (Test-Path $path) {
            if (Remove-Safe $path) {
                Write-Host "    Removed $f" -ForegroundColor Green
                $removed++
            } else {
                Write-Host "    Failed to remove $f" -ForegroundColor Red
            }
        }
    }
    return $removed
}

function Verify-Codex($Dir) {
    if (!(Test-Path $Dir)) {
        Write-Host '    Codex dir not found (not deployed)' -ForegroundColor DarkGray
        return $true
    }
    $checks = @(
        @{ File = 'AGENTS.md';  Pattern = 'cc-unlock' },
        @{ File = 'config.toml'; Pattern = 'AGENTS.md' }
    )
    $allOk = $true
    foreach ($c in $checks) {
        $path = Join-Path $Dir $c.File
        if (Test-Path $path) {
            $sz = (Get-Item $path).Length
            $content = ''
            try { $content = Get-Content $path -Raw -ErrorAction Stop } catch {}
            if ($content -match $c.Pattern) {
                Write-Host "    $($c.File) - OK ($sz bytes)" -ForegroundColor Green
            } else {
                Write-Host "    $($c.File) - CONTENT MISMATCH ($sz bytes)" -ForegroundColor Yellow
                $allOk = $false
            }
        } else {
            Write-Host "    $($c.File) - MISSING" -ForegroundColor Red
            $allOk = $false
        }
    }
    return $allOk
}

# --- Pre-flight ---
function Test-Preflight($Dst, $Src) {
    $issues = @()
    if (!(Test-DiskSpace $Dst))          { $issues += 'Low disk space' }
    if ($Dst.Length -gt 240)             { $issues += 'Path too long (>240 chars)' }
    if (!(Test-Path $Src))               { $issues += "Source not found: $Src" }
    foreach ($f in @('CLAUDE.md', 'system-prompt.md')) {
        if (!(Test-Path (Join-Path $Src $f))) { $issues += "Missing: $f" }
    }
    return $issues
}

# --- Display ---
function Show-Banner {
    Write-Host ''
    Write-Host '============================================' -ForegroundColor Cyan
    Write-Host '  cc-unlock Deploy v2.0' -ForegroundColor Green
    Write-Host '  Claude Code + Codex Dual-CLI Config' -ForegroundColor DarkGray
    Write-Host '============================================' -ForegroundColor Cyan
    Write-Host ''
}

function Show-Environment {
    Write-Host "[*] User   : $env:USERNAME" -ForegroundColor DarkGray
    Write-Host "[*] PS     : $PS_VER ($PS_FLAVOR)" -ForegroundColor DarkGray
    Write-Host "[*] OS     : $OS_VER (Build $OS_BUILD)" -ForegroundColor DarkGray
    Write-Host "[*] Admin  : $IS_ADMIN" -ForegroundColor DarkGray
    Write-Host "[*] Home   : $USER_HOME" -ForegroundColor DarkGray
    Write-Host "[*] Target : $CLAUDE_DIR" -ForegroundColor DarkGray
    Write-Host "[*] Dirs   : $($ALL_DIRS.Count) detected" -ForegroundColor DarkGray
    foreach ($d in $ALL_DIRS) { Write-Host "             $d" -ForegroundColor DarkGray }
    Write-Host "[*] Codex  : $CODEX_DIR" -ForegroundColor DarkGray
    if (Test-Path $CODEX_BUNDLE_DIR) {
        Write-Host "[*] Codex src: found" -ForegroundColor DarkGray
    } else {
        Write-Host "[*] Codex src: not found (Codex deploy will be skipped)" -ForegroundColor DarkGray
    }
}

function Show-Warnings {
    $w = @()
    if ($USER_HOME -match '[^\x00-\x7F]') { $w += 'User profile path contains non-ASCII characters' }
    if ($USER_HOME -match '\s')            { $w += 'User profile path contains spaces' }
    try { if ($PSVersionTable.PSVersion.Major -lt 3) { $w += 'PowerShell <3.0: some features limited' } } catch {}
    foreach ($msg in $w) { Write-Host "[!] $msg" -ForegroundColor Yellow }
    return $w.Count
}

# === MAIN ===

Show-Banner
Show-Environment
$wc = Show-Warnings
if ($wc -gt 0) { Write-Host '' }

# --- Uninstall ---
if ($Uninstall) {
    Write-Host 'Uninstalling cc-unlock ...' -ForegroundColor Yellow
    foreach ($dir in $ALL_DIRS) {
        Write-Host "  $dir" -ForegroundColor DarkGray
        Uninstall-Config $dir | Out-Null
    }
    # Codex
    if (Test-Path $CODEX_DIR) {
        Write-Host "  $CODEX_DIR (Codex)" -ForegroundColor DarkGray
        Uninstall-Codex $CODEX_DIR | Out-Null
    }
    Write-Host ''
    Write-Host 'Attempting to restore latest backup ...' -ForegroundColor Yellow
    Restore-Config $CLAUDE_DIR | Out-Null
    Write-Host ''
    Write-Host 'Uninstall complete. Restart Claude Code / Codex.' -ForegroundColor Green
    Write-Host ''
    Read-Host 'Press Enter to exit'
    exit
}

# --- Verify ---
if ($Verify) {
    Write-Host 'Verifying deployment ...' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  Claude Code:' -ForegroundColor Cyan
    foreach ($dir in $ALL_DIRS) {
        Write-Host "  $dir" -ForegroundColor DarkGray
        Verify-Config $dir | Out-Null
    }
    Write-Host ''
    Write-Host '  Codex:' -ForegroundColor Cyan
    Write-Host "  $CODEX_DIR" -ForegroundColor DarkGray
    Verify-Codex $CODEX_DIR | Out-Null
    Write-Host ''
    Read-Host 'Press Enter to exit'
    exit
}

# --- Restore ---
if ($Restore) {
    Write-Host 'Restoring from backup ...' -ForegroundColor Yellow
    if (Restore-Config $CLAUDE_DIR) {
        Write-Host 'Restore complete!' -ForegroundColor Green
    } else {
        Write-Host 'No backup to restore.' -ForegroundColor Yellow
    }
    Write-Host ''
    Read-Host 'Press Enter to exit'
    exit
}

# --- Deploy ---

$preflight = Test-Preflight $CLAUDE_DIR $BUNDLE_DIR
if ($preflight.Count -gt 0) {
    Write-Host '[!] Pre-flight issues:' -ForegroundColor Red
    foreach ($p in $preflight) { Write-Host "    - $p" -ForegroundColor Red }
    Write-Host ''
    Read-Host 'Press Enter to exit'
    exit 1
}

# Lock file
$lockFile = Join-Path $CLAUDE_DIR '.cc-unlock-deploy.lock'
if (Test-Path $lockFile) {
    Write-Host '[!] Another deployment may be in progress' -ForegroundColor Yellow
    $ans = Read-Host 'Continue anyway? (Y/N)'
    if ($ans -ne 'Y' -and $ans -ne 'y') { exit 0 }
}

# Ensure target
if (!(Test-Path $CLAUDE_DIR)) {
    if (New-DirSafe $CLAUDE_DIR) {
        Write-Host '[+] Created .claude directory' -ForegroundColor Yellow
    } else {
        Write-Host '[!] Failed to create .claude directory' -ForegroundColor Red
        Read-Host 'Press Enter to exit'
        exit 1
    }
}

# Lock
try {
    $utf8 = New-Object System.Text.UTF8Encoding $false
    $sw   = New-Object System.IO.StreamWriter($lockFile, $false, $utf8)
    $sw.WriteLine("$env:USERNAME - $(Get-Date)")
    $sw.Close()
} catch {}

# Backup
$bc = Backup-Config $CLAUDE_DIR
if ($bc -gt 0) { Write-Host "[*] Backed up $bc existing files" -ForegroundColor DarkGray }

# Deploy primary
Write-Host ''
Write-Host "Deploying to: $CLAUDE_DIR" -ForegroundColor Cyan
$result = Deploy-Config $CLAUDE_DIR $BUNDLE_DIR

# Deploy to additional directories
foreach ($dir in $ALL_DIRS) {
    if ($dir -ne $CLAUDE_DIR) {
        Write-Host ''
        Write-Host "Deploying to: $dir" -ForegroundColor Cyan
        $dr = Deploy-Config $dir $BUNDLE_DIR
        if ($dr.Fail -eq 0) {
            Write-Host "  Complete ($($dr.Ok)/4)" -ForegroundColor Green
        } else {
            Write-Host "  Partial ($($dr.Ok) ok, $($dr.Fail) fail)" -ForegroundColor Yellow
        }
    }
}

# --- Deploy Codex ---
$codexResult = @{ Ok = 0; Fail = 0 }
if (Test-Path $CODEX_BUNDLE_DIR) {
    if (!(Test-Path $CODEX_DIR)) {
        if (New-DirSafe $CODEX_DIR) {
            Write-Host '[+] Created .codex directory' -ForegroundColor Yellow
        }
    }
    if (Test-Path $CODEX_DIR) {
        $cbc = Backup-Codex $CODEX_DIR
        if ($cbc -gt 0) { Write-Host "[*] Backed up $cbc existing Codex files" -ForegroundColor DarkGray }
        Write-Host ''
        Write-Host "Deploying Codex to: $CODEX_DIR" -ForegroundColor Cyan
        $codexResult = Deploy-Codex $CODEX_DIR $CODEX_BUNDLE_DIR
    }
} else {
    Write-Host ''
    Write-Host 'Codex bundle not found, skipping Codex deploy.' -ForegroundColor DarkGray
}

# Remove lock
Remove-Safe $lockFile | Out-Null

# Summary
$totalOk   = $result.Ok   + $codexResult.Ok
$totalFail = $result.Fail  + $codexResult.Fail
Write-Host ''
Write-Host '============================================' -ForegroundColor Cyan
if ($totalFail -eq 0) {
    Write-Host "  Deploy complete!" -ForegroundColor Green
    Write-Host "    Claude Code: $($result.Ok)/4" -ForegroundColor Green
    if ($codexResult.Ok -gt 0) {
        Write-Host "    Codex:       $($codexResult.Ok)/2" -ForegroundColor Green
    }
} else {
    Write-Host "  Deploy done ($totalOk ok, $totalFail fail)" -ForegroundColor Yellow
    if (!$IS_ADMIN) { Write-Host '  Try running as administrator' -ForegroundColor DarkGray }
}
Write-Host ''
Write-Host '  Restart Claude Code / Codex to activate.' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''
Read-Host 'Press Enter to exit'
