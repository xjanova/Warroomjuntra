#!/bin/bash
# Warroom Juntra · server-side deploy script
# Runs on DirectAdmin host. Triggered by GitHub Actions or manual `./deploy.sh` over SSH.
#
# Pattern mirrors juntraweb deploy.sh — minus PHP/Laravel steps, plus Node build.
# Expects DEPLOY_PATH env var = document root (e.g. /home/admin/domains/<domain>/public_html)

set -euo pipefail

# ============================================================
# CONFIG
# ============================================================
DEPLOY_PATH="${DEPLOY_PATH:-/home/admin/domains/warroom.xn--82c4af5bzdj.online/public_html}"
BRANCH="${BRANCH:-main}"
BUILD_DIR="out"

cd "$DEPLOY_PATH"

echo "════════════════════════════════════════════════════════════════"
echo "🔮 Warroom Juntra · deploy.sh"
echo "════════════════════════════════════════════════════════════════"
echo "Path:   $DEPLOY_PATH"
echo "Branch: $BRANCH"
echo "Time:   $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ============================================================
# 1. Pull latest code
# ============================================================
echo "» [1/6] Fetching latest from origin..."
git fetch --all --tags --prune
# WARNING: git stash -u in deploy.sh has burned us before (eats untracked files
# like .env / hand-placed shims). Skip stash entirely — git reset --hard
# overwrites only tracked files and leaves untracked alone.
git reset --hard "origin/$BRANCH"
echo "✓ HEAD: $(git rev-parse --short HEAD) · $(git log -1 --pretty=format:'%s')"
echo ""

# ============================================================
# 2. Install dependencies
# ============================================================
echo "» [2/6] Installing npm dependencies..."
if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund
else
    npm install --no-audit --no-fund
fi
echo "✓ Dependencies installed"
echo ""

# ============================================================
# 3. Build static export
# ============================================================
echo "» [3/6] Building Next.js static export..."
npm run build
if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ Build directory '$BUILD_DIR' not found — did Next.js fail to export?"
    exit 1
fi
echo "✓ Build output ready in $BUILD_DIR/"
echo ""

# ============================================================
# 4. Sync to public_html
# ============================================================
# Strategy: move build output into a sibling staging dir, then atomic-swap.
# This keeps the document root live during the rsync and avoids partial states.
STAGING="$DEPLOY_PATH/.deploy-staging"
LIVE_FILES=(_next assets index.html chat.html bills.html payment.html approvals.html moderation.html bots.html customers.html events.html predict.html 404.html .htaccess)

echo "» [4/6] Staging build output..."
rm -rf "$STAGING"
mkdir -p "$STAGING"
# Copy everything from `out` into staging
cp -a "$BUILD_DIR/." "$STAGING/"
# Carry over the .htaccess that lives at the repo root (SPA / trailingSlash rules)
if [ -f "$DEPLOY_PATH/.htaccess.public" ]; then
    cp "$DEPLOY_PATH/.htaccess.public" "$STAGING/.htaccess"
fi
echo "✓ Staged at $STAGING"
echo ""

echo "» [5/6] Swapping into document root..."
# We don't want to wipe the entire public_html (that's where node_modules + repo live).
# Only swap the "live" web files — everything in $LIVE_FILES.
for f in "${LIVE_FILES[@]}"; do
    # Remove old (file or directory) before bringing in the new one.
    rm -rf "$DEPLOY_PATH/$f"
    if [ -e "$STAGING/$f" ]; then
        mv "$STAGING/$f" "$DEPLOY_PATH/$f"
    fi
done
# Also bring in any new top-level files (e.g. trailing slash route dirs Next.js generates)
# but exclude .next, node_modules, src, etc.
shopt -s dotglob nullglob
for entry in "$STAGING"/*; do
    base=$(basename "$entry")
    # skip if already moved
    case "$base" in
        _next|assets|*.html|.htaccess) continue ;;
    esac
    rm -rf "$DEPLOY_PATH/$base"
    mv "$entry" "$DEPLOY_PATH/$base"
done
shopt -u dotglob nullglob

rm -rf "$STAGING"
echo "✓ Live"
echo ""

# ============================================================
# 6. Health check
# ============================================================
echo "» [6/6] Health check..."
HEALTH_URL="${HEALTH_URL:-}"
if [ -n "$HEALTH_URL" ]; then
    if curl -sf -o /dev/null --max-time 10 "$HEALTH_URL"; then
        echo "✓ $HEALTH_URL responded OK"
    else
        echo "⚠ Health check failed for $HEALTH_URL"
    fi
else
    echo "(skipped — set HEALTH_URL env to enable)"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Deploy complete · $(date '+%H:%M:%S')"
echo "════════════════════════════════════════════════════════════════"
