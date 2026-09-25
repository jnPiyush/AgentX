#!/usr/bin/env bash
# deploy-prototype.sh
# Thin adapter that shells out to the chosen target's official CLI.
# The plugin NEVER reads or stores tokens. Credentials live in the user's
# shell session (env vars or the CLI's own auth store).

set -euo pipefail

TARGET=""
BUILD_DIR="dist"
PROJECT_NAME=""
BRANCH="gh-pages"
PROD=0

usage() {
  cat <<EOF
Usage: deploy-prototype.sh --target <vercel|netlify|cloudflare|github-pages|surge>
                           [--build-dir <path>] [--project-name <name>]
                           [--branch <name>] [--prod]
EOF
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2;;
    --build-dir) BUILD_DIR="$2"; shift 2;;
    --project-name) PROJECT_NAME="$2"; shift 2;;
    --branch) BRANCH="$2"; shift 2;;
    --prod) PROD=1; shift;;
    -h|--help) usage;;
    *) echo "Unknown arg: $1" >&2; usage;;
  esac
done

[[ -z "$TARGET" ]] && usage

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[deploy-prototype] '$1' is not on PATH. $2" >&2
    exit 2
  fi
}

if [[ ! -d "$BUILD_DIR" ]]; then
  echo "[deploy-prototype] Build directory '$BUILD_DIR' does not exist. Run your build first (for example 'npm run build')." >&2
  exit 3
fi

echo "[deploy-prototype] Target=$TARGET BuildDir=$BUILD_DIR Prod=$PROD"

case "$TARGET" in
  vercel)
    require_cmd vercel "Install with: npm i -g vercel"
    if [[ $PROD -eq 1 ]]; then
      vercel "$BUILD_DIR" --yes --prod
    else
      vercel "$BUILD_DIR" --yes
    fi
    ;;
  netlify)
    require_cmd netlify "Install with: npm i -g netlify-cli"
    args=(deploy --dir "$BUILD_DIR")
    [[ -n "$PROJECT_NAME" ]] && args+=(--site "$PROJECT_NAME")
    [[ $PROD -eq 1 ]] && args+=(--prod)
    netlify "${args[@]}"
    ;;
  cloudflare)
    require_cmd wrangler "Install with: npm i -g wrangler"
    if [[ -z "$PROJECT_NAME" ]]; then
      echo "[deploy-prototype] Cloudflare Pages requires --project-name" >&2
      exit 4
    fi
    wrangler pages deploy "$BUILD_DIR" --project-name "$PROJECT_NAME"
    ;;
  github-pages)
    require_cmd gh "Install GitHub CLI: https://cli.github.com/"
    tmp="$(mktemp -d)"
    trap 'git worktree remove "$tmp" --force >/dev/null 2>&1 || true' EXIT
    git worktree add "$tmp" "$BRANCH" 2>/dev/null || git worktree add -B "$BRANCH" "$tmp"
    # Clear the worktree contents (excluding .git) before copying the build.
    # Uses 'find ... -delete' (depth-first) so both files and directories are removed
    # without invoking a recursive force delete command.
    find "$tmp" -depth -mindepth 1 ! -path "$tmp/.git" ! -path "$tmp/.git/*" -delete
    # Copy build output INCLUDING dotfiles (e.g. .nojekyll required by GitHub Pages).
    # The trailing '/.' form copies hidden entries that a bare '/*' glob would skip.
    cp -R "$BUILD_DIR"/. "$tmp"/
    (
      cd "$tmp"
      git add -A
      git commit -m "deploy: prototype build" || true
      git push origin "$BRANCH"
    )
    ;;
  surge)
    require_cmd surge "Install with: npm i -g surge"
    if [[ -n "$PROJECT_NAME" ]]; then
      surge "$BUILD_DIR" "$PROJECT_NAME.surge.sh"
    else
      surge "$BUILD_DIR"
    fi
    ;;
  *)
    echo "Unknown target: $TARGET" >&2
    usage
    ;;
esac

echo "[deploy-prototype] OK"
