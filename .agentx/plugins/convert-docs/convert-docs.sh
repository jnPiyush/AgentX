#!/bin/bash
DIR="$(dirname "$0")"
pwsh "$DIR/convert-docs.ps1" "$@"
