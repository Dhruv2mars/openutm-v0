#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="/Applications"

ELECTRON_APP="$ROOT_DIR/apps/electron/release/mac-arm64/OpenUTM (Electron).app"
TAURI_APP="$ROOT_DIR/apps/tauri/src-tauri/target/release/bundle/macos/OpenUTM (Tauri).app"

if [[ ! -d "$ELECTRON_APP" ]]; then
  echo "missing bundle: $ELECTRON_APP" >&2
  exit 1
fi

if [[ ! -d "$TAURI_APP" ]]; then
  echo "missing bundle: $TAURI_APP" >&2
  exit 1
fi

ditto "$ELECTRON_APP" "$DEST_DIR/OpenUTM (Electron).app"
ditto "$TAURI_APP" "$DEST_DIR/OpenUTM (Tauri).app"

echo "installed: $DEST_DIR/OpenUTM (Electron).app"
echo "installed: $DEST_DIR/OpenUTM (Tauri).app"
