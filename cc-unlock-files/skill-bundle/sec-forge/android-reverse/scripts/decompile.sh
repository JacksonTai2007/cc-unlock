#!/usr/bin/env bash
# decompile.sh — Decompile Android APK/XAPK/JAR/AAR with jadx and/or fernflower
# Usage: bash decompile.sh <target> -o <output-dir> [--deobf] [--engine jadx|fernflower|both] [--no-res]
set -euo pipefail

ENGINE="jadx"
DEOBF=false
NO_RES=false
OUTPUT=""
TARGET=""
FERNFLOWER_TIMEOUT="${FERNFLOWER_TIMEOUT_SECONDS:-300}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -o|--output)  OUTPUT="$2"; shift 2 ;;
        --deobf)      DEOBF=true; shift ;;
        --no-res)     NO_RES=true; shift ;;
        --engine)     ENGINE="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: decompile.sh <target> -o <output-dir> [--deobf] [--engine jadx|fernflower|both] [--no-res]"
            exit 0 ;;
        *)            TARGET="$1"; shift ;;
    esac
done

if [ -z "$TARGET" ]; then echo "ERROR: No target file specified"; exit 1; fi
if [ -z "$OUTPUT" ]; then OUTPUT="${TARGET%.*}-decompiled"; fi

TARGET="$(realpath "$TARGET" 2>/dev/null || echo "$TARGET")"
mkdir -p "$OUTPUT"

EXT="${TARGET##*.}"

log() { echo "[$(date +%H:%M:%S)] $*"; }

case "$EXT" in
    xapk|apks) EXT="xapk" ;;
    aab)       log "ERROR: AAB requires bundletool to extract APKs first"; exit 1 ;;
esac

# ── jadx decompile ──────────────────────────────────────────────────
run_jadx() {
    local input="$1" outdir="$2"
    local opts=(-d "$outdir" --show-bad-code --threads-count "$(nproc 2>/dev/null || echo 4)")
    if $DEOBF; then opts+=(--deobf); fi
    if $NO_RES; then opts+=(--no-res); fi
    log "jadx decompiling: $input"
    jadx "${opts[@]}" "$input" 2>&1 || log "WARN: jadx exited with errors (partial output may exist)"
}

# ── fernflower decompile ────────────────────────────────────────────
run_fernflower() {
    local input="$1" outdir="$2"
    local ff_cmd=""
    if command -v vineflower &>/dev/null; then ff_cmd="vineflower"
    elif command -v fernflower &>/dev/null; then ff_cmd="fernflower"
    elif [ -f "${HOME}/.local/bin/vineflower" ]; then ff_cmd="${HOME}/.local/bin/vineflower"
    elif [ -f "${HOME}/.local/bin/fernflower" ]; then ff_cmd="${HOME}/.local/bin/fernflower"
    else log "ERROR: fernflower/vineflower not found"; return 1; fi

    # For APK, need dex2jar intermediate
    local jar_input="$input"
    if [[ "$input" == *.apk || "$input" == *.xapk ]]; then
        if ! command -v dex2jar &>/dev/null && ! command -v d2j-dex2jar.sh &>/dev/null; then
            log "ERROR: dex2jar required for fernflower on APK"; return 1
        fi
        local d2j_cmd=""
        command -v d2j-dex2jar.sh &>/dev/null && d2j_cmd="d2j-dex2jar.sh" || d2j_cmd="dex2jar"
        jar_input="$outdir/dex2jar-output.jar"
        log "dex2jar: $input -> $jar_input"
        $d2j_cmd "$input" -o "$jar_input" 2>&1 || { log "ERROR: dex2jar failed"; return 1; }
    fi

    log "fernflower decompiling: $jar_input"
    # Portable timeout: works on macOS (no GNU timeout) and Linux
    "$ff_cmd" -dgs=1 -ren=1 "$jar_input" "$outdir" 2>&1 &
    local ff_pid=$!
    local elapsed=0
    while kill -0 "$ff_pid" 2>/dev/null && [ "$elapsed" -lt "$FERNFLOWER_TIMEOUT" ]; do
        sleep 5
        elapsed=$((elapsed + 5))
    done
    if kill -0 "$ff_pid" 2>/dev/null; then
        kill "$ff_pid" 2>/dev/null
        log "WARN: fernflower timed out after ${FERNFLOWER_TIMEOUT}s"
    else
        wait "$ff_pid" 2>/dev/null || log "WARN: fernflower exited with errors"
    fi
}

# ── XAPK handling ───────────────────────────────────────────────────
handle_xapk() {
    local xapk="$1" outdir="$2"
    local tmpdir
    tmpdir="$(mktemp -d)"
    log "Extracting XAPK: $xapk"
    unzip -q -o "$xapk" -d "$tmpdir"

    local manifest="$tmpdir/manifest.json"
    if [ -f "$manifest" ]; then
        log "XAPK manifest found, listing inner APKs:"
        python3 -c 'import json, sys
m = json.load(open(sys.argv[1]))
for ap in m.get("split_apks", m.get("apks", [])):
    print(f"  {ap.get('file', ap.get('id', '?'))} — {ap.get('module_name', ap.get('id', 'unknown'))}")' "$manifest" 2>/dev/null || ls "$tmpdir"/*.apk 2>/dev/null
    fi

    # Decompile each inner APK
    for apk in "$tmpdir"/*.apk; do
        [ -f "$apk" ] || continue
        local name
        name="$(basename "${apk%.apk}")"
        log "Decompiling inner APK: $name"
        case "$ENGINE" in
            jadx)        run_jadx "$apk" "$outdir/$name" ;;
            fernflower)  run_fernflower "$apk" "$outdir/$name" ;;
            both)
                run_jadx "$apk" "$outdir/$name/jadx"
                run_fernflower "$apk" "$outdir/$name/fernflower"
                ;;
        esac
    done

    rm -rf "$tmpdir"
}

# ── Main dispatch ───────────────────────────────────────────────────
case "$EXT" in
    xapk|apks)
        handle_xapk "$TARGET" "$OUTPUT"
        ;;
    *)
        case "$ENGINE" in
            jadx)
                run_jadx "$TARGET" "$OUTPUT"
                ;;
            fernflower)
                run_fernflower "$TARGET" "$OUTPUT"
                ;;
            both)
                run_jadx "$TARGET" "$OUTPUT/jadx"
                run_fernflower "$TARGET" "$OUTPUT/fernflower"
                ;;
            *)
                log "ERROR: Unknown engine '$ENGINE' (use jadx|fernflower|both)"
                exit 1
                ;;
        esac
        ;;
esac

log "Output: $OUTPUT"

# Quick summary
java_files=$(find "$OUTPUT" -name "*.java" 2>/dev/null | wc -l)
log "Decompiled Java files: $java_files"
