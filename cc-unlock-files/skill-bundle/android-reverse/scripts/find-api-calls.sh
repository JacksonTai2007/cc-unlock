#!/usr/bin/env bash
# find-api-calls.sh — Search decompiled source for API calls and endpoints
# Usage: bash find-api-calls.sh <source-dir> [--retrofit] [--okhttp] [--volley] [--urls] [--auth] [--all]
set -euo pipefail

SRC=""
MODES=()
DEFAULT_MODES=("retrofit" "okhttp" "volley" "urls" "auth")

while [[ $# -gt 0 ]]; do
    case "$1" in
        --retrofit|--okhttp|--volley|--urls|--auth)
            MODES+=("${1#--}") ;;
        --all) MODES=("retrofit" "okhttp" "volley" "urls" "auth") ;;
        -h|--help)
            echo "Usage: find-api-calls.sh <source-dir> [--retrofit] [--okhttp] [--volley] [--urls] [--auth] [--all]"
            exit 0 ;;
        *) SRC="$1" ;;
    esac
    shift
done

if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
    echo "ERROR: Source directory not found: $SRC"
    exit 1
fi

if [ ${#MODES[@]} -eq 0 ]; then MODES=("${DEFAULT_MODES[@]}"); fi

separator() { echo ""; echo "═══════════════════════════════════════════════════"; echo "$1"; echo "═══════════════════════════════════════════════════"; }

# ── Retrofit ────────────────────────────────────────────────────────
search_retrofit() {
    separator "Retrofit API Endpoints"
    grep -rn --include="*.java" --include="*.kt" \
        -E '@(GET|POST|PUT|DELETE|PATCH|HEAD|HTTP|OPTIONS|Headers)\(' \
        "$SRC" 2>/dev/null || echo "  (none found)"

    echo ""
    echo "── Base URLs ──"
    grep -rn --include="*.java" --include="*.kt" \
        -E 'baseUrl\s*\(' "$SRC" 2>/dev/null || echo "  (none found)"

    echo ""
    echo "── Retrofit Builder ──"
    grep -rn --include="*.java" --include="*.kt" \
        -E 'Retrofit\.Builder' "$SRC" 2>/dev/null || echo "  (none found)"
}

# ── OkHttp ──────────────────────────────────────────────────────────
search_okhttp() {
    separator "OkHttp API Calls"
    grep -rn --include="*.java" --include="*.kt" \
        -E '(Request\.Builder|HttpUrl\.Builder|newCall\()' \
        "$SRC" 2>/dev/null || echo "  (none found)"

    echo ""
    echo "── OkHttp Interceptors ──"
    grep -rn --include="*.java" --include="*.kt" \
        -E '(addInterceptor|addNetworkInterceptor|Interceptor)' \
        "$SRC" 2>/dev/null || echo "  (none found)"
}

# ── Volley ──────────────────────────────────────────────────────────
search_volley() {
    separator "Volley Requests"
    grep -rn --include="*.java" --include="*.kt" \
        -E '(StringRequest|JsonObjectRequest|JsonArrayRequest|RequestQueue|ImageRequest)' \
        "$SRC" 2>/dev/null || echo "  (none found)"
}

# ── Hardcoded URLs ──────────────────────────────────────────────────
search_urls() {
    separator "Hardcoded URLs & Base URLs"
    grep -rn --include="*.java" --include="*.kt" --include="*.xml" \
        -E 'https?://[^\s"<>]+' \
        "$SRC" 2>/dev/null | grep -v '/res/values' | head -100 || echo "  (none found)"

    echo ""
    echo "── URL Constants ──"
    grep -rn --include="*.java" --include="*.kt" \
        -E '(BASE_URL|API_URL|SERVER_URL|HOST|ENDPOINT)\s*=' \
        "$SRC" 2>/dev/null || echo "  (none found)"
}

# ── Auth Patterns ───────────────────────────────────────────────────
search_auth() {
    separator "Authentication Patterns"
    grep -rn --include="*.java" --include="*.kt" \
        -E '(Authorization|Bearer|Token|API_KEY|SECRET|X-Api-Key|Basic\s+auth|addHeader\(")' \
        "$SRC" 2>/dev/null | head -50 || echo "  (none found)"

    echo ""
    echo "── Certificate Pinning ──"
    grep -rn --include="*.java" --include="*.kt" \
        -E '(CertificatePinner|TrustManager|pinning|sha256/)' \
        "$SRC" 2>/dev/null || echo "  (none found)"

    echo ""
    echo "── WebView JS Interface ──"
    grep -rn --include="*.java" --include="*.kt" \
        -E '(addJavascriptInterface|evaluateJavascript|@JavascriptInterface)' \
        "$SRC" 2>/dev/null || echo "  (none found)"
}

# ── Run selected modes ─────────────────────────────────────────────
for mode in "${MODES[@]}"; do
    case "$mode" in
        retrofit) search_retrofit ;;
        okhttp)   search_okhttp ;;
        volley)   search_volley ;;
        urls)     search_urls ;;
        auth)     search_auth ;;
    esac
done
