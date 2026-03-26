#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

eval "$(fnm env --use-on-cd 2>/dev/null)"

# --- Auto-download termframe ---
TERMFRAME_BIN="${TMPDIR:-/tmp}/termframe"

if [ ! -x "$TERMFRAME_BIN" ]; then
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"

  case "$OS" in
    linux)  OS_NAME="linux" ;;
    darwin) OS_NAME="macos" ;;
    *)      echo "Unsupported OS: $OS" >&2; exit 1 ;;
  esac

  case "$ARCH" in
    x86_64|amd64)  ARCH_NAME="x86_64" ;;
    aarch64|arm64) ARCH_NAME="arm64" ;;
    *)             echo "Unsupported arch: $ARCH" >&2; exit 1 ;;
  esac

  if [ "$OS_NAME" = "macos" ]; then
    ASSET="termframe-macos-${ARCH_NAME}.tar.gz"
  else
    ASSET="termframe-linux-${ARCH_NAME}-gnu.tar.gz"
  fi

  TAG=$(curl -fsSL "https://api.github.com/repos/pamburus/termframe/releases/latest" | grep -o '"tag_name": *"[^"]*"' | cut -d'"' -f4)
  URL="https://github.com/pamburus/termframe/releases/download/${TAG}/${ASSET}"

  echo "Downloading termframe ${TAG} (${ASSET})..."
  curl -fsSL "$URL" | tar -xz -C "${TMPDIR:-/tmp}" termframe
  chmod +x "$TERMFRAME_BIN"
fi

TERMFRAME_ARGS="--padding 2 -H auto -W 80"
TERMFRAME_CMD="pnpm create-nitro-app nitro-app"

# --- Generate dark preview ---
echo "Generating dark preview..."
rm -rf ../nitro-app
"$TERMFRAME_BIN" -o ./preview-dark.svg $TERMFRAME_ARGS --mode dark -- $TERMFRAME_CMD
echo "Generated ./preview-dark.svg"

# --- Generate light preview ---
echo "Generating light preview..."
rm -rf ../nitro-app
"$TERMFRAME_BIN" -o ./preview-light.svg $TERMFRAME_ARGS --mode light -- $TERMFRAME_CMD
echo "Generated ./preview-light.svg"

# --- Cleanup ---
rm -rf ../nitro-app
echo "Done!"
