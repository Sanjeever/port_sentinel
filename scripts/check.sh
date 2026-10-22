#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend typecheck
pnpm --dir frontend test
pnpm --dir frontend build
node --test scripts/version.test.mjs
node scripts/version.mjs check "v$(node -p 'JSON.parse(require("fs").readFileSync("frontend/package.json","utf8")).version')"
unformatted=$(gofmt -l ./*.go internal)
if [ -n "$unformatted" ]; then echo "$unformatted" >&2; exit 1; fi
case "$(uname -s)" in
  Darwin)
    export CGO_CFLAGS="${CGO_CFLAGS:-} -mmacosx-version-min=12.0"
    export CGO_LDFLAGS="${CGO_LDFLAGS:-} -mmacosx-version-min=12.0"
    export GOFLAGS="${GOFLAGS:-} -ldflags=-linkmode=external"
    go test ./...
    go vet ./...
    ;;
  Linux) go test -tags webkit2_41 ./...; go vet -tags webkit2_41 ./... ;;
  *) go test ./...; go vet ./... ;;
esac
