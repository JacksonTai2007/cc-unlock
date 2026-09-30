#!/usr/bin/env bash
# One unified installer entry point; the Node builder owns versions and payload validation.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
exec node scripts/build-alpha-installer.cjs "$@"
