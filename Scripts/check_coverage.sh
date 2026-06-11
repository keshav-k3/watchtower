#!/bin/bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

swift test --enable-code-coverage >/dev/null
coverage_json="$(swift test --show-codecov-path)"

files=(
  "$repo_root/Sources/CodexBar/InstallOrigin.swift"
  "$repo_root/Sources/CodexBar/ProviderToggleStore.swift"
  "$repo_root/Sources/CodexBarCore/Providers/ProviderBranding.swift"
  "$repo_root/Sources/CodexBarCore/Providers/ProviderCLIConfig.swift"
  "$repo_root/Sources/CodexBarCore/Providers/Providers.swift"
  "$repo_root/Sources/CodexBarCore/Providers/ProviderCookieSource.swift"
  "$repo_root/Sources/CodexBarCore/Providers/Cursor/CursorRequestUsage.swift"
)

file_list_json="$(printf '%s\n' "${files[@]}" | jq -R . | jq -s .)"

jq -e --argjson files "$file_list_json" '
  .data[0].files
  | map(select(.filename as $filename | $files | index($filename)))
  | length == ($files | length)
' "$coverage_json" >/dev/null

noncompliant="$(jq -r --argjson files "$file_list_json" '
  .data[0].files
  | map(select(.filename as $filename | $files | index($filename)))
  | map(select(.summary.lines.percent != 100))
  | .[]
  | "\(.filename)\t\(.summary.lines.percent)\t\(.summary.lines.covered)\t\(.summary.lines.count)"
' "$coverage_json")"

if [[ -z "$noncompliant" ]]; then
  total="$(jq -r --argjson files "$file_list_json" '
    [.data[0].files[] | select(.filename as $filename | $files | index($filename)) | .summary.lines]
    | {count: (map(.count) | add), covered: (map(.covered) | add)}
    | "\(.covered)/\(.count) lines covered (100%)"
  ' "$coverage_json")"
  echo "Scoped coverage passed: $total"
else
  echo "Scoped coverage failed for:"
  echo "$noncompliant"
  exit 1
fi
