#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
contents_dir=$(dirname -- "$(dirname -- "$1")")
temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT
iconset="$temp_dir/app.iconset"
mkdir "$iconset"

# Wails 的 ICNS 编码器缺少标准倍率图层，Finder 列表无法正确显示小图标。
for size in 16 32 128 256 512; do
    sips -z "$size" "$size" "$project_dir/build/appicon.png" --out "$iconset/icon_${size}x${size}.png" >/dev/null
    retina_size=$((size * 2))
    sips -z "$retina_size" "$retina_size" "$project_dir/build/appicon.png" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$iconset" -o "$contents_dir/Resources/iconfile.icns"

# 替换资源后重新签名，保持 Wails 本地构建的临时签名有效。
codesign --force --sign - "$contents_dir/.."
