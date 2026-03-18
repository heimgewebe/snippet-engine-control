#!/usr/bin/env bash
set -euo pipefail

# snippet-engine-control
# Canonical local rebuild and diagnosis script.
# This script is intended to be run from the repository root.
#
# Usage:
#   ./scripts/update-local.sh
#
# Environment variables:
#   SEC_RUN_TESTS=1    - Set to 1 to run tests after build
#   ESPANSO_DIR        - Override espanso config path

if [ ! -f package.json ] || [ ! -d packages ]; then
  echo "[ERROR] Please run this script from the repository root."
  exit 1
fi

echo "============================================================"
echo " SEC Local Rebuild & Diagnose"
echo "============================================================"

# Note: We intentionally skip 'git pull' here.
# Pulling should happen before executing this script or via a dedicated
# bootstrap script to avoid silently updating local repository state
# when the user just wanted to rebuild.

echo "[1/4] Installing dependencies..."
npm install

echo "[2/4] Building packages..."
npm run build || {
  echo "[ERROR] build failed. Please check the compiler errors above."
  echo "You may need to clean stale dist/ artifacts or node_modules."
  exit 1
}

echo "[3/4] Running tests (if SEC_RUN_TESTS=1)..."
if [ "${SEC_RUN_TESTS:-0}" = "1" ]; then
  npm test
else
  echo "  Skipped (set SEC_RUN_TESTS=1 to enable)."
fi

echo "[4/4] Running Diagnostics..."
DEBUG_SCRIPT="./scripts/espanso-debug.sh"
if [ -x "$DEBUG_SCRIPT" ]; then
  "$DEBUG_SCRIPT"
else
  echo "[WARN] Debug script not found or not executable at $DEBUG_SCRIPT"
fi

echo -e "\nRunning SEC Doctor..."
ESPANSO_DIR="${ESPANSO_DIR:-$HOME/.config/espanso}"
node packages/cli/dist/src/index.js doctor --engine espanso --dir "$ESPANSO_DIR" || {
  echo "[ERROR] SEC doctor detected issues."
  exit 1
}

echo -e "\n============================================================"
echo " Update and Diagnostics complete."
echo " Start UI via: npm run ui"
echo "============================================================"
