#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${ROOT}/releases"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
NAME="dare-bot-2026"

zip_source() {
  echo "[*] Zipping source for production..."
  ZIP="${OUTPUT_DIR}/${NAME}-source-${TIMESTAMP}.zip"
  mkdir -p "$OUTPUT_DIR"
  cd "$ROOT"
  zip -r "$ZIP" \
    src/ \
    package.json \
    pnpm-lock.yaml \
    tsconfig.json \
    .env.example \
    .prettierrc \
    eslint.config.js \
    -x "*.mp3" -x "*.wav" -x "src/audios/*" -x "node_modules/*" -x ".env" -x "dist/*" -x ".git/*"
  echo "[+] Created: $ZIP"
}

zip_build() {
  echo "[*] Building..."
  cd "$ROOT"
  pnpm build
  echo "[*] Zipping build for production..."
  ZIP="${OUTPUT_DIR}/${NAME}-build-${TIMESTAMP}.zip"
  mkdir -p "$OUTPUT_DIR"
  zip -r "$ZIP" \
    dist/ \
    package.json \
    pnpm-lock.yaml \
    .env.example \
    -x "node_modules/*" -x ".env"
  echo "[+] Created: $ZIP"
}

case "${1:-}" in
  prod|source)
    zip_source
    ;;
  build)
    zip_build
    ;;
  *)
    echo "Usage: $0 {prod|build}"
    echo ""
    echo "  prod   - Zip source (src/, package.json, etc.) for Pterodactyl"
    echo "           Run: pnpm install && pnpm build && pnpm start"
    echo ""
    echo "  build  - Build locally, then zip dist/ for Pterodactyl"
    echo "           Run: pnpm install --prod && node dist/index.js"
    exit 1
    ;;
esac
