#!/bin/bash
DIR="$(dirname "$0")"
pwsh "$DIR/agentx-cli.ps1" issue "$@"
