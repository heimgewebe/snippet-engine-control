#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo " Espanso Local Environment Debugger"
echo "============================================================"

# Resolve Espanso dir with basic OS fallback
if [ -z "${ESPANSO_DIR:-}" ]; then
  if [ "$(uname -s)" = "Darwin" ]; then
    ESPANSO_DIR="$HOME/Library/Application Support/espanso"
  else
    ESPANSO_DIR="$HOME/.config/espanso"
  fi
fi

MATCH_DIR="$ESPANSO_DIR/match"
CONFIG_FILE="$ESPANSO_DIR/config/default.yml"

echo -e "\n1. Checking Base Directories:"
if [ -d "$ESPANSO_DIR" ]; then
  echo "  [OK] Espanso Config Directory exists: $ESPANSO_DIR"
else
  echo "  [ERROR] Espanso Config Directory not found: $ESPANSO_DIR"
  exit 1
fi

if [ -d "$MATCH_DIR" ]; then
  echo "  [OK] Espanso Match Directory exists: $MATCH_DIR"
else
  echo "  [ERROR] Espanso Match Directory not found: $MATCH_DIR"
  exit 1
fi

echo -e "\n2. Checking Core Config:"
if [ -f "$CONFIG_FILE" ]; then
  echo "  [OK] Default config exists: $CONFIG_FILE"
else
  echo "  [WARN] Default config not found at: $CONFIG_FILE"
fi

echo -e "\n3. Listing Match Files:"
find "$MATCH_DIR" -maxdepth 1 -type f | sort | while read -r file; do
  echo "  - $(basename "$file")"
done

echo -e "\n4. Checking Engine Status (espanso):"
if command -v espanso >/dev/null 2>&1; then
  echo "  Espanso binary found. Status:"
  espanso status || echo "  [WARN] Could not retrieve espanso status."
else
  echo "  [WARN] espanso command not found in PATH."
fi

echo -e "\n============================================================"
echo " Diagnose complete."
