#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/packages/yama-cli/dist/yama-cli/src/cli.js" "$@"

