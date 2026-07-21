#!/usr/bin/env bash
#
# Package Api Inspector into a store-ready .zip excluding dev-only files.
#
# Usage:
#   scripts/package.sh             # builds dist/api-inspector-<version>.zip
#   scripts/package.sh v1.1.0      # tag the output filename explicitly
#
# Prereqs:
#   - zip(1) on PATH
#   - manifest.json contains the source-of-truth version

set -euo pipefail

# Resolve repo root (this script lives in <root>/scripts/).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  # Read version from manifest.json without jq to avoid an extra dependency.
  VERSION="$(grep -E '"version"' manifest.json | head -1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
fi

if [[ -z "$VERSION" ]]; then
  echo "Could not determine version from manifest.json" >&2
  exit 1
fi

DIST="dist"
ZIP="${DIST}/api-inspector-v${VERSION}.zip"
STAGE="${DIST}/api-inspector"

echo "==> Packaging Api Inspector v${VERSION}"

rm -rf "$DIST"
mkdir -p "$STAGE"

# Files included in the packaged extension. Keep in sync with the manifest's
# references and the README's Project Structure.
INCLUDE=(
  manifest.json
  background.js
  content.js
  inject.js
  popup.html
  popup.js
  styles.css
  options.html
  options.js
  options.css
  PRIVACY.md
  LICENSE
  icons
  utils
)

for item in "${INCLUDE[@]}"; do
  if [[ ! -e "$item" ]]; then
    echo "Missing required file: $item" >&2
    exit 1
  fi
  cp -r "$item" "$STAGE/"
done

# Verify utils/ does not contain any tests or dev-only files.
rm -rf "$STAGE/utils"/__tests__ "$STAGE/utils"/*.test.js

mkdir -p "$DIST"
(cd "$DIST" && zip -qr "$(basename "$ZIP")" "api-inspector")
rm -rf "$STAGE"

echo "==> Created $ZIP ($(du -h "$ZIP" | cut -f1))"

# Optional: validate with web-ext if installed (Firefox add-on linter).
if command -v web-ext >/dev/null 2>&1; then
  echo "==> Running web-ext lint"
  web-ext lint -s "$DIST" || true
else
  echo "==> Tip: install web-ext (npm i -g web-ext) to validate the package"
fi
