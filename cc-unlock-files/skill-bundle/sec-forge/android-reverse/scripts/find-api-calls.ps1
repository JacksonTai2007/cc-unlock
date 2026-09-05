# find-api-calls.ps1 — Search decompiled source for API calls and endpoints
# Usage: find-api-calls.ps1 <source-dir> [-Retrofit] [-Okhttp] [-Volley] [-Urls] [-Auth] [-All]
param(
    [Parameter(Position=0)]
    [string]$Source = '',
    [switch]$Retrofit,
    [switch]$Okhttp,
    [switch]$Volley,
    [switch]$Urls,
    [switch]$Auth,
    [switch]$All
)

$ErrorActionPreference = 'Continue'

if (-not $Source -or -not (Test-Path $Source -PathType Container)) {
    Write-Host "ERROR: Source directory not found: $Source"; exit 1
}

# Default to all if none specified
$runAll = (-not ($Retrofit -or $Okhttp -or $Volley -or $Urls -or $Auth)) -or $All

function Write-Separator($title) {
    Write-Host ''
    Write-Host ('=' * 60)
    Write-Host $title
    Write-Host ('=' * 60)
}

function Find-Pattern($pattern, $label) {
    $results = Get-ChildItem -Path $Source -Include '*.java','*.kt' -Recurse |
        Select-String -Pattern $pattern -CaseSensitive:$false |
        Select-Object -First 50
    if ($results) {
        $results | ForEach-Object { Write-Host "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }
    } else {
        Write-Host "  (none found)"
    }
}

# ── Retrofit ────────────────────────────────────────────────────────
if ($runAll -or $Retrofit) {
    Write-Separator 'Retrofit API Endpoints'
    Find-Pattern '@(GET|POST|PUT|DELETE|PATCH|HEAD|HTTP|OPTIONS|Headers)\(' 'Retrofit annotations'
    Write-Host ''
    Write-Host '-- Base URLs --'
    Find-Pattern 'baseUrl\s*\(' 'Base URLs'
    Write-Host ''
    Write-Host '-- Retrofit Builder --'
    Find-Pattern 'Retrofit\.Builder' 'Builder'
}

# ── OkHttp ──────────────────────────────────────────────────────────
if ($runAll -or $Okhttp) {
    Write-Separator 'OkHttp API Calls'
    Find-Pattern '(Request\.Builder|HttpUrl\.Builder|newCall\()' 'OkHttp'
    Write-Host ''
    Write-Host '-- OkHttp Interceptors --'
    Find-Pattern '(addInterceptor|addNetworkInterceptor)' 'Interceptors'
}

# ── Volley ──────────────────────────────────────────────────────────
if ($runAll -or $Volley) {
    Write-Separator 'Volley Requests'
    Find-Pattern '(StringRequest|JsonObjectRequest|JsonArrayRequest|RequestQueue)' 'Volley'
}

# ── Hardcoded URLs ──────────────────────────────────────────────────
if ($runAll -or $Urls) {
    Write-Separator 'Hardcoded URLs & Constants'
    Find-Pattern 'https?://[^\s"<>]+' 'URLs'
    Write-Host ''
    Write-Host '-- URL Constants --'
    Find-Pattern '(BASE_URL|API_URL|SERVER_URL|HOST|ENDPOINT)\s*=' 'Constants'
}

# ── Auth Patterns ───────────────────────────────────────────────────
if ($runAll -or $Auth) {
    Write-Separator 'Authentication Patterns'
    Find-Pattern '(Authorization|Bearer|Token|API_KEY|SECRET|X-Api-Key)' 'Auth'
    Write-Host ''
    Write-Host '-- Certificate Pinning --'
    Find-Pattern '(CertificatePinner|TrustManager|sha256/)' 'Pinning'
    Write-Host ''
    Write-Host '-- WebView JS Interface --'
    Find-Pattern '(addJavascriptInterface|evaluateJavascript|@JavascriptInterface)' 'WebView'
}
