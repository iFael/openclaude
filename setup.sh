#!/usr/bin/env bash
set -euo pipefail

echo "========================================="
echo "  OpenClaude — Setup"
echo "========================================="
echo ""

# Check prerequisites
for cmd in node npm bun; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' not found. Please install it first."
    exit 1
  fi
done

echo "[1/4] Installing dependencies..."
npm install

echo ""
echo "[2/4] Building CLI..."
bun run build

echo ""
echo "[3/4] Installing openclaude globally..."
npm install -g

echo ""
echo "[4/4] Verifying installation..."
if command -v openclaude &>/dev/null; then
  VERSION=$(openclaude --version 2>/dev/null || echo "unknown")
  echo ""
  echo "========================================="
  echo "  Done! openclaude $VERSION installed"
  echo "========================================="
  echo ""
  echo "Usage:"
  echo "  openclaude          Start interactive session"
  echo "  openclaude --help   Show all options"
else
  echo ""
  echo "WARNING: 'openclaude' not found in PATH after install."
  echo "Try opening a new terminal and running: openclaude --version"
fi
