#!/bin/bash
DIR="$(dirname "$0")"
node "$DIR/cli.mjs" issue "$@"
