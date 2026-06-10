#!/usr/bin/env bash
set -euo pipefail
CONF=${1:-release}
ALLOW_LLDB=${WATCHTOWER_ALLOW_LLDB:-0}
SIGNING_MODE=${WATCHTOWER_SIGNING:-}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
LOWER_CONF=$(printf "%s" "$CONF" | tr '[:upper:]' '[:lower:]')

source "$ROOT/version.env"

if [[ "${WATCHTOWER_FORCE_CLEAN:-0}" == "1" ]]; then
  swift package clean >/dev/null 2>&1 || true
fi

ARCH_LIST=( ${ARCHES:-} )
if [[ ${#ARCH_LIST[@]} -eq 0 ]]; then
  HOST_ARCH=$(uname -m)
  case "$HOST_ARCH" in
    arm64) ARCH_LIST=(arm64) ;;
    x86_64) ARCH_LIST=(x86_64) ;;
    *) ARCH_LIST=("$HOST_ARCH") ;;
  esac
fi

for ARCH in "${ARCH_LIST[@]}"; do
  swift build -c "$CONF" --arch "$ARCH"
done

APP_FINAL="$ROOT/Watchtower.app"
APP_STAGE="$ROOT/.build/package/Watchtower.app"
rm -rf "$APP_STAGE"
APP="$APP_STAGE"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

ICON_SOURCE="$ROOT/Icon.icon"
ICON_TARGET="$ROOT/Icon.icns"
if [[ -f "$ICON_SOURCE" ]]; then
  iconutil --convert icns --output "$ICON_TARGET" "$ICON_SOURCE"
fi

BUNDLE_ID="com.keshavk3.watchtower"
if [[ "$LOWER_CONF" == "debug" ]]; then
  BUNDLE_ID="com.keshavk3.watchtower.debug"
fi

ENTITLEMENTS_DIR="$ROOT/.build/entitlements"
APP_ENTITLEMENTS="${ENTITLEMENTS_DIR}/Watchtower.entitlements"
mkdir -p "$ENTITLEMENTS_DIR"
if [[ "$ALLOW_LLDB" == "1" && "$LOWER_CONF" != "debug" ]]; then
  echo "ERROR: WATCHTOWER_ALLOW_LLDB requires debug configuration" >&2
  exit 1
fi
cat > "$APP_ENTITLEMENTS" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    $(if [[ "$ALLOW_LLDB" == "1" ]]; then echo "    <key>com.apple.security.get-task-allow</key><true/>"; fi)
</dict>
</plist>
PLIST

BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>Watchtower</string>
    <key>CFBundleDisplayName</key><string>Watchtower</string>
    <key>CFBundleIdentifier</key><string>${BUNDLE_ID}</string>
    <key>CFBundleExecutable</key><string>Watchtower</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>${MARKETING_VERSION}</string>
    <key>CFBundleVersion</key><string>${BUILD_NUMBER}</string>
    <key>LSMinimumSystemVersion</key><string>14.0</string>
    <key>LSUIElement</key><true/>
    <key>CFBundleIconFile</key><string>Icon</string>
    <key>NSHumanReadableCopyright</key><string>Based on CodexBar by Peter Steinberger. MIT License.</string>
    <key>WatchtowerBuildTimestamp</key><string>${BUILD_TIMESTAMP}</string>
    <key>WatchtowerGitCommit</key><string>${GIT_COMMIT}</string>
</dict>
</plist>
PLIST

build_product_path() {
  local name="$1"
  local arch="$2"
  case "$arch" in
    arm64|x86_64) echo ".build/${arch}-apple-macosx/$CONF/$name" ;;
    *) echo ".build/$CONF/$name" ;;
  esac
}

resolve_binary_path() {
  local name="$1"
  local arch="$2"
  local candidate
  candidate=$(build_product_path "$name" "$arch")
  if [[ -f "$candidate" ]]; then
    echo "$candidate"
    return
  fi
  if [[ -f ".build/$CONF/$name" ]]; then
    echo ".build/$CONF/$name"
  fi
}

install_binary() {
  local name="$1"
  local dest="$2"
  local binaries=()
  for arch in "${ARCH_LIST[@]}"; do
    local src
    src=$(resolve_binary_path "$name" "$arch")
    if [[ -z "$src" || ! -f "$src" ]]; then
      echo "ERROR: Missing ${name} build for ${arch}" >&2
      exit 1
    fi
    binaries+=("$src")
  done
  if [[ ${#ARCH_LIST[@]} -gt 1 ]]; then
    lipo -create "${binaries[@]}" -output "$dest"
  else
    cp "${binaries[0]}" "$dest"
  fi
  chmod +x "$dest"
}

install_binary "Watchtower" "$APP/Contents/MacOS/Watchtower"

if [[ -f "$ICON_TARGET" ]]; then
  cp "$ICON_TARGET" "$APP/Contents/Resources/Icon.icns"
fi

APP_RESOURCES_DIR="$ROOT/Sources/CodexBar/Resources"
if [[ -d "$APP_RESOURCES_DIR" ]]; then
  cp -R "$APP_RESOURCES_DIR/." "$APP/Contents/Resources/"
fi

WATCHTOWER_BINARY="$(resolve_binary_path "Watchtower" "${ARCH_LIST[0]}")"
PREFERRED_BUILD_DIR="$(dirname "${WATCHTOWER_BINARY}")"
shopt -s nullglob
SWIFTPM_BUNDLES=("${PREFERRED_BUILD_DIR}/"*.bundle)
shopt -u nullglob
if [[ ${#SWIFTPM_BUNDLES[@]} -gt 0 ]]; then
  for bundle in "${SWIFTPM_BUNDLES[@]}"; do
    cp -R "$bundle" "$APP/Contents/Resources/"
  done
fi

chmod -R u+w "$APP"
xattr -cr "$APP"
find "$APP" -name '._*' -delete

if [[ "$SIGNING_MODE" == "adhoc" || "$ALLOW_LLDB" == "1" ]]; then
  CODESIGN_ID="-"
else
  CODESIGN_ID="${APP_IDENTITY:--}"
fi
codesign --force --sign "$CODESIGN_ID" \
  --entitlements "$APP_ENTITLEMENTS" \
  "$APP"

rm -rf "$APP_FINAL"
mv "$APP" "$APP_FINAL"
echo "Created $APP_FINAL"
