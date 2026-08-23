# check-deps.ps1 — Verify Android reverse engineering tool dependencies
# Exit 0 if all required deps available, 1 if any required dep missing
$ErrorActionPreference = 'Stop'

$RequiredDeps = @('java', 'jadx')
$OptionalDeps = @('fernflower', 'dex2jar', 'apktool', 'adb', 'frida')
$script:missingRequired = 0

function Write-Status($tag, $msg) { Write-Host "[$tag] $msg" }

function Test-Java {
    try {
        $java = Get-Command java -ErrorAction SilentlyContinue
        if ($java) {
            $verOut = & java -version 2>&1 | Select-String '\d+' | Select-Object -First 1
            $verNum = if ($verOut -match '(\d+)') { [int]$Matches[1] } else { 0 }
            if ($verNum -ge 17) {
                Write-Status 'OK' "Java $verNum found"
                return $true
            } else {
                Write-Status 'WARN' "Java $verNum found, but 17+ required"
                return $false
            }
        }
    } catch {}
    return $false
}

function Test-Jadx {
    try {
        $jadx = Get-Command jadx -ErrorAction SilentlyContinue
        if ($jadx) {
            Write-Status 'OK' "jadx found"
            return $true
        }
    } catch {}
    return $false
}

function Test-Fernflower {
    try {
        $ff = Get-Command fernflower -ErrorAction SilentlyContinue
        $vf = Get-Command vineflower -ErrorAction SilentlyContinue
        if ($ff -or $vf) {
            Write-Status 'OK' "Fernflower/Vineflower found"
            return $true
        }
        $localFF = Join-Path $env:USERPROFILE '.local\bin\fernflower.bat'
        $localVF = Join-Path $env:USERPROFILE '.local\bin\vineflower.bat'
        if ((Test-Path $localFF) -or (Test-Path $localVF)) {
            Write-Status 'OK' "Fernflower/Vineflower found in ~/.local/bin"
            return $true
        }
    } catch {}
    return $false
}

# Refresh PATH from user environment
$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'User') + ';' + [System.Environment]::GetEnvironmentVariable('PATH', 'Machine')

# Check required
foreach ($dep in $RequiredDeps) {
    $found = $false
    switch ($dep) {
        'java' { $found = Test-Java }
        'jadx' { $found = Test-Jadx }
        default { $found = [bool](Get-Command $dep -ErrorAction SilentlyContinue) }
    }
    if (-not $found) {
        Write-Output "INSTALL_REQUIRED:$dep"
        $script:missingRequired = 1
    }
}

# Check optional
foreach ($dep in $OptionalDeps) {
    $found = $false
    switch ($dep) {
        'fernflower' { $found = Test-Fernflower }
        default { $found = [bool](Get-Command $dep -ErrorAction SilentlyContinue) }
    }
    if (-not $found) {
        Write-Output "INSTALL_OPTIONAL:$dep"
    }
}

exit $script:missingRequired
