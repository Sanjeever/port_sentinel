#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
variables=(MACOS_CERTIFICATE MACOS_CERTIFICATE_PASSWORD MACOS_SIGNING_IDENTITY APPLE_ID APPLE_TEAM_ID APPLE_APP_PASSWORD)
provided=0
for variable in "${variables[@]}"; do if [ -n "${!variable:-}" ]; then provided=$((provided+1)); fi; done
if [ "$provided" -eq 0 ]; then echo '未配置签名凭据，分发无 Developer ID 签名、公证的 macOS 包。'; exit 0; fi
if [ "$provided" -ne 6 ]; then echo 'macOS 签名与公证凭据不完整。' >&2; exit 1; fi
sign_dir=$(mktemp -d "${RUNNER_TEMP:-/tmp}/port-sentinel-sign.XXXXXX")
sign_keychain="$sign_dir/release.keychain-db"
sign_password=$(openssl rand -hex 24)
cleanup(){
  result=$?
  if [ -f "$sign_keychain" ] && ! security delete-keychain "$sign_keychain"; then result=1; fi
  if ! rm -rf "$sign_dir"; then result=1; fi
  exit "$result"
}
trap cleanup EXIT
printf '%s' "$MACOS_CERTIFICATE" | base64 -D > "$sign_dir/certificate.p12"
security create-keychain -p "$sign_password" "$sign_keychain"
security set-keychain-settings -lut 21600 "$sign_keychain"
security unlock-keychain -p "$sign_password" "$sign_keychain"
security import "$sign_dir/certificate.p12" -k "$sign_keychain" -P "$MACOS_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
security set-key-partition-list -S apple-tool:,apple: -s -k "$sign_password" "$sign_keychain"
app=build/bin/port-sentinel.app
# 同一可执行文件包含主界面、一次性授权和更新辅助模式。
codesign --force --options runtime --timestamp --keychain "$sign_keychain" --sign "$MACOS_SIGNING_IDENTITY" "$app/Contents/MacOS/port-sentinel"
codesign --force --options runtime --timestamp --keychain "$sign_keychain" --sign "$MACOS_SIGNING_IDENTITY" "$app"
codesign --verify --deep --strict "$app"
ditto -c -k --keepParent "$app" "$sign_dir/notarize.zip"
xcrun notarytool submit "$sign_dir/notarize.zip" --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_PASSWORD" --wait
xcrun stapler staple "$app"
xcrun stapler validate "$app"
