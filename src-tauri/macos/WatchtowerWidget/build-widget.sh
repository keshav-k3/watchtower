#!/usr/bin/env bash
# Builds the WidgetKit extension and the in-process reload bridge.
# No-op off macOS. Tauri runs this before it packs the .app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Watchtower widget: skipping (macOS build only)."
  exit 0
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Watchtower widget: xcodebuild was not found. Install Xcode, then run this script again." >&2
  exit 1
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Watchtower widget: installing xcodegen..."
    brew install xcodegen
  else
    echo "Watchtower widget: install xcodegen (brew install xcodegen), then run this script again." >&2
    exit 1
  fi
fi

CONF="$ROOT/../../tauri.conf.json"
VERSION="0.6.31"
if [[ -f "$CONF" ]]; then
  VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$CONF")"
fi

cd "$ROOT"
xcodegen generate

OUT="$ROOT/build/Release"
rm -rf "$OUT"
mkdir -p "$OUT"

# No arrays: macOS /bin/bash 3.2 treats an empty "${array[@]}" as unbound under `set -u`.
XCODE_ARCH=""
case "${TAURI_ENV_ARCH:-}" in
  aarch64) XCODE_ARCH="arm64" ;;
  x86_64) XCODE_ARCH="x86_64" ;;
esac

run_xcodebuild() {
  if [[ -n "$XCODE_ARCH" ]]; then
    xcodebuild "$@" ARCHS="$XCODE_ARCH" ONLY_ACTIVE_ARCH=YES build
  else
    xcodebuild "$@" build
  fi
}

run_xcodebuild \
  -project "$ROOT/WatchtowerWidget.xcodeproj" \
  -scheme WatchtowerWidget \
  -configuration Release \
  -destination "platform=macOS" \
  -derivedDataPath "$ROOT/build/DerivedData" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  MARKETING_VERSION="$VERSION" \
  CURRENT_PROJECT_VERSION=1 \
  CONFIGURATION_BUILD_DIR="$OUT"

APPEX="$OUT/WatchtowerWidget.appex"
if [[ ! -d "$APPEX" ]]; then
  echo "Watchtower widget: Xcode did not produce WatchtowerWidget.appex in $OUT" >&2
  find "$OUT" -maxdepth 3 -type d -name '*.appex' -print >&2 || true
  exit 1
fi

DYLIB="$OUT/libWatchtowerWidgetBridge.dylib"
if [[ ! -f "$DYLIB" ]]; then
  FOUND="$(find "$OUT" -maxdepth 2 -name '*WatchtowerWidgetBridge*.dylib' -print | head -n 1 || true)"
  if [[ -z "${FOUND}" ]]; then
    echo "Watchtower widget: Xcode did not produce the bridge dylib in $OUT" >&2
    exit 1
  fi
  cp "$FOUND" "$DYLIB"
fi

IDENTITY="${WIDGET_SIGN_IDENTITY:-${APPLE_SIGNING_IDENTITY:-}}"
if [[ -z "$IDENTITY" ]]; then
  IDENTITY="-"
fi

sign() {
  local target="$1"
  shift
  if [[ "$IDENTITY" != "-" ]]; then
    if codesign --force --sign "$IDENTITY" --options runtime --timestamp "$@" "$target"; then
      return 0
    fi
    echo "Watchtower widget: timestamp server failed, signing $target without a timestamp." >&2
  fi
  codesign --force --sign "$IDENTITY" --options runtime --timestamp=none "$@" "$target"
}

INNER="$APPEX/Contents/MacOS/WatchtowerWidget"
if [[ ! -f "$INNER" ]]; then
  INNER="$(find "$APPEX/Contents/MacOS" -type f -maxdepth 1 | head -n 1)"
fi

sign "$INNER"
sign "$APPEX" --entitlements "$ROOT/WatchtowerWidget.entitlements"
sign "$DYLIB"

echo "Watchtower widget built:"
echo "  $APPEX"
echo "  $DYLIB"
echo "  signed as: $IDENTITY"
