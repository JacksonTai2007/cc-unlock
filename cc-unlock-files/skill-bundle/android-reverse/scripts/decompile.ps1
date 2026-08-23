# decompile.ps1 — Decompile Android APK/XAPK/JAR/AAR with jadx and/or fernflower
# Usage: decompile.ps1 <target> -o <output-dir> [-Deobf] [-Engine jadx|fernflower|both] [-NoRes]
param(
    [Parameter(Position=0)]
    [string]$Target = '',
    [string]$Output = '',
    [switch]$Deobf,
    [ValidateSet('jadx','fernflower','both')]
    [string]$Engine = 'jadx',
    [switch]$NoRes
)

$ErrorActionPreference = 'Stop'

if (-not $Target) { Write-Host 'ERROR: No target file specified'; exit 1 }
if (-not (Test-Path $Target)) { Write-Host "ERROR: File not found: $Target"; exit 1 }
if (-not $Output) {
    $base = [System.IO.Path]::GetDirectoryName($Target)
    $name = [System.IO.Path]::GetFileNameWithoutExtension($Target)
    $Output = Join-Path $base "$name-decompiled"
}

# Refresh PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'User') + ';' + [System.Environment]::GetEnvironmentVariable('PATH', 'Machine')

$Target = (Resolve-Path $Target).Path
New-Item -ItemType Directory -Force -Path $Output | Out-Null

$ext = [System.IO.Path]::GetExtension($Target).TrimStart('.').ToLower()
if ($ext -in @('xapk', 'apks')) { $ext = 'xapk' }

function Write-Log($msg) { Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] $msg" }

# ── jadx decompile ──────────────────────────────────────────────────
function Invoke-Jadx([string]$Target, [string]$OutDir) {
    $opts = @('-d', $OutDir, '--show-bad-code', '--threads-count', '4')
    if ($Deobf) { $opts += '--deobf' }
    if ($NoRes) { $opts += '--no-res' }
    Write-Log "jadx decompiling: $Target"
    try { & jadx @opts $Target 2>&1 } catch { Write-Log "WARN: jadx exited with errors (partial output may exist)" }
}

# ── fernflower decompile ────────────────────────────────────────────
function Invoke-Fernflower([string]$Target, [string]$OutDir) {
    $ffCmd = $null
    if (Get-Command vineflower -ErrorAction SilentlyContinue) { $ffCmd = 'vineflower' }
    elseif (Get-Command fernflower -ErrorAction SilentlyContinue) { $ffCmd = 'fernflower' }
    else { Write-Log 'ERROR: fernflower/vineflower not found'; return }

    $jarInput = $Target
    if ($Target -match '\.(apk|xapk)$') {
        $d2j = Get-Command d2j-dex2jar.bat -ErrorAction SilentlyContinue
        if (-not $d2j) { $d2j = Get-Command dex2jar -ErrorAction SilentlyContinue }
        if (-not $d2j) { Write-Log 'ERROR: dex2jar required for fernflower on APK'; return }
        $jarInput = Join-Path $OutDir 'dex2jar-output.jar'
        Write-Log "dex2jar: $Target -> $jarInput"
        & $d2j.Source $Target -o $jarInput 2>&1
    }

    Write-Log "fernflower decompiling: $jarInput"
    try { & $ffCmd -dgs=1 -ren=1 $jarInput $OutDir 2>&1 } catch { Write-Log 'WARN: fernflower exited with errors' }
}

# ── XAPK handling ───────────────────────────────────────────────────
function Invoke-XapkDecompile([string]$Xapk, [string]$OutDir) {
    $tmpdir = Join-Path $env:TEMP "xapk-$(Get-Random)"
    Write-Log "Extracting XAPK: $Xapk"
    Expand-Archive -Path $Xapk -DestinationPath $tmpdir -Force

    $manifest = Join-Path $tmpdir 'manifest.json'
    if (Test-Path $manifest) {
        Write-Log 'XAPK manifest found'
        $m = Get-Content $manifest | ConvertFrom-Json
        $apkList = if ($m.split_apks) { $m.split_apks } elseif ($m.apks) { $m.apks } else { @() }
        $apkList | ForEach-Object { Write-Log "  $($_.file) — $($_.id)" }
    }

    Get-ChildItem -Path $tmpdir -Filter '*.apk' | ForEach-Object {
        $name = $_.BaseName
        Write-Log "Decompiling inner APK: $name"
        switch ($Engine) {
            'jadx'        { Invoke-Jadx $_.FullName (Join-Path $OutDir $name) }
            'fernflower'  { Invoke-Fernflower $_.FullName (Join-Path $OutDir $name) }
            'both'        {
                Invoke-Jadx $_.FullName (Join-Path $OutDir "$name\jadx")
                Invoke-Fernflower $_.FullName (Join-Path $OutDir "$name\fernflower")
            }
        }
    }

    Remove-Item $tmpdir -Recurse -Force
}

# ── Main dispatch ───────────────────────────────────────────────────
switch ($ext) {
    'xapk' { Invoke-XapkDecompile $Target $Output }
    default {
        switch ($Engine) {
            'jadx'        { Invoke-Jadx $Target $Output }
            'fernflower'  { Invoke-Fernflower $Target $Output }
            'both'        {
                Invoke-Jadx $Target (Join-Path $Output 'jadx')
                Invoke-Fernflower $Target (Join-Path $Output 'fernflower')
            }
        }
    }
}

Write-Log "Output: $Output"
$javaCount = (Get-ChildItem -Path $Output -Filter '*.java' -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Log "Decompiled Java files: $javaCount"
