# install-dep.ps1 — Install a single Android reverse engineering dependency
# Usage: install-dep.ps1 <dep-name>
# Exit codes: 0=success, 1=failed, 2=manual action needed
param(
    [Parameter(Position=0)]
    [string]$Dep = ''
)

if (-not $Dep) { Write-Host 'Usage: install-dep.ps1 <java|jadx|fernflower|dex2jar|apktool|adb>'; exit 1 }

$ErrorActionPreference = 'Stop'
$localBin = Join-Path $env:USERPROFILE '.local\bin'
New-Item -ItemType Directory -Force -Path $localBin | Out-Null

function Install-Java {
    # Check for existing Java 17+
    $java = Get-Command java -ErrorAction SilentlyContinue
    if ($java) {
        $ver = & java -version 2>&1 | Select-String '\d+' | ForEach-Object { $_.Matches[0].Value } | Select-Object -First 1
        if ([int]$ver -ge 17) { Write-Host 'OK: Java already installed'; return }
    }
    # Try winget first
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host 'Installing Eclipse Temurin 17 via winget...'
        winget install EclipseAdoptium.Temurin.17.JDK --accept-package-agreements --accept-source-agreements
        return
    }
    # Try scoop
    if (Get-Command scoop -ErrorAction SilentlyContinue) {
        Write-Host 'Installing temurin17-jdk via scoop...'
        scoop install temurin17-jdk
        return
    }
    Write-Host 'MANUAL: Install Java 17+ from https://adoptium.net/'
    exit 2
}

function Install-Jadx {
    Write-Host 'Finding latest jadx release...'
    $apiUrl = 'https://api.github.com/repos/skylot/jadx/releases/latest'
    try {
        $release = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing
        $version = $release.tag_name -replace '^v', ''
    } catch {
        Write-Host 'WARN: Could not detect latest version, falling back to 1.5.1'
        $version = '1.5.1'
    }
    $url = "https://github.com/skylot/jadx/releases/download/v${version}/jadx-${version}.zip"
    $dest = Join-Path $env:USERPROFILE '.local\share\jadx'
    New-Item -ItemType Directory -Force -Path $dest | Out-Null

    Write-Host "Downloading jadx v${version}..."
    $zip = Join-Path $env:TEMP 'jadx.zip'
    try {
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    } catch {
        Write-Host "ERROR: Download failed ($($_.Exception.Message)). Install manually from https://github.com/skylot/jadx/releases"
        exit 1
    }
    Expand-Archive -Path $zip -DestinationPath $dest -Force
    Remove-Item $zip

    # Create wrapper scripts
    $jadxBat = Join-Path $localBin 'jadx.bat'
    Set-Content $jadxBat "@echo off`n`"$dest\bin\jadx.bat`" %*"
    $jadxGuiBat = Join-Path $localBin 'jadx-gui.bat'
    Set-Content $jadxGuiBat "@echo off`n`"$dest\bin\jadx-gui.bat`" %*"
    Write-Host "OK: jadx v${version} installed to $dest"
}

function Install-Fernflower {
    Write-Host 'Finding latest vineflower release...'
    $apiUrl = 'https://api.github.com/repos/Vineflower/vineflower/releases/latest'
    try {
        $release = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing
        $asset = $release.assets | Where-Object { $_.name -like '*.jar' } | Select-Object -First 1
        if (-not $asset) { throw 'No jar asset found' }
        $jarUrl = $asset.browser_download_url
    } catch {
        Write-Host "MANUAL: Download vineflower from https://github.com/Vineflower/vineflower/releases ($($_.Exception.Message))"
        exit 2
    }
    Write-Host "Downloading: $jarUrl"
    $jarPath = Join-Path $localBin 'vineflower.jar'
    try {
        Invoke-WebRequest -Uri $jarUrl -OutFile $jarPath -UseBasicParsing
    } catch {
        Write-Host "ERROR: Download failed ($($_.Exception.Message))"
        exit 1
    }

    $bat = Join-Path $localBin 'vineflower.bat'
    Set-Content $bat "@echo off`njava -jar `"$jarPath`" %*"
    Write-Host 'OK: vineflower installed'
}

function Install-Dex2jar {
    if (Get-Command scoop -ErrorAction SilentlyContinue) {
        scoop install dex2jar
        return
    }
    Write-Host 'MANUAL: Download dex2jar from https://github.com/pxb1988/dex2jar/releases'
    exit 2
}

function Install-Apktool {
    $url = 'https://bitbucket.org/APerezAppworksLLC/apktool/downloads/apktool_2.9.3.jar'
    $jarPath = Join-Path $localBin 'apktool.jar'
    Invoke-WebRequest -Uri $url -OutFile $jarPath -UseBasicParsing
    $bat = Join-Path $localBin 'apktool.bat'
    Set-Content $bat "@echo off`njava -jar `"$jarPath`" %*"
    Write-Host 'OK: apktool installed'
}

function Install-Adb {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install Google.PlatformTools --accept-package-agreements --accept-source-agreements
        return
    }
    if (Get-Command scoop -ErrorAction SilentlyContinue) {
        scoop install adb
        return
    }
    Write-Host 'MANUAL: Install from https://developer.android.com/studio/releases/platform-tools'
    exit 2
}

switch ($Dep.ToLower()) {
    'java'        { Install-Java }
    'jadx'        { Install-Jadx }
    'fernflower'  { Install-Fernflower }
    'dex2jar'     { Install-Dex2jar }
    'apktool'     { Install-Apktool }
    'adb'         { Install-Adb }
    default       { Write-Host "ERROR: Unknown dependency: $Dep"; exit 1 }
}
