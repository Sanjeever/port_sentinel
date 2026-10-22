#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
action=${1:-build}
if [ "$#" -gt 0 ]; then shift; fi
case "$action" in dev|build|generate) ;; *) echo '用法：sh scripts/desktop.sh dev|build|generate [Wails 参数]' >&2; exit 1;; esac
ldflags="-X main.releaseBuild=${PORT_SENTINEL_RELEASE_BUILD:-false} -X main.buildCommit=$(git rev-parse HEAD)"
case "$(uname -s)" in
  Darwin)
    export MACOSX_DEPLOYMENT_TARGET=12.0
    export CGO_CFLAGS="${CGO_CFLAGS:-} -mmacosx-version-min=12.0"
    export CGO_LDFLAGS="${CGO_LDFLAGS:-} -mmacosx-version-min=12.0"
    export GOFLAGS="${GOFLAGS:-} -ldflags=-linkmode=external"
    ldflags="-linkmode=external $ldflags"
    ;;
  Linux) set -- "$@" -tags webkit2_41 ;;
esac
if [ "$action" = generate ]; then exec wails generate module; fi
exec wails "$action" -nosyncgomod "$@" -ldflags "$ldflags"
