#!/bin/bash
DIR="$(dirname "$0")"
pwsh "$DIR/frontier-cli.ps1" issue "$@"
