# Deploy · Warroom Juntra

> Static export → DirectAdmin · mirrors the [juntraweb](https://github.com/xjanova/juntraweb) deploy pattern.

---

## TLDR

```
git push origin main   →   GitHub Actions   →   SSH to server   →   bash deploy.sh
```

The deploy.sh script: `git pull` → `npm ci` → `npm run build` → atomic swap of `out/` into `public_html`.

---

## One-time setup

### 1. Create the subdomain in DirectAdmin

Suggested: `warroom.จันทรา.online` (`warroom.xn--82c4af5bzdj.online` in Punycode).

In DirectAdmin → Subdomain Management → create `warroom`. The doc root becomes
`/home/admin/domains/warroom.xn--82c4af5bzdj.online/public_html`.

If you prefer a different domain (e.g. `warroom.xmanstudio.com`), update
the `DEPLOY_PATH` variable on the repo.

### 2. Clone the repo on the server

```bash
ssh admin@123.253.62.251
cd /home/admin/domains/warroom.xn--82c4af5bzdj.online
rm -rf public_html
git clone https://github.com/xjanova/Warroomjuntra public_html
cd public_html
chmod +x deploy.sh
```

### 3. Make sure Node 20+ is on PATH

DirectAdmin's default shell may not have Node. Check:

```bash
node --version    # need 20+
npm --version     # need 10+
```

If missing, install via NVM as the `admin` user:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm alias default 20
```

### 4. First build on the server

```bash
cd /home/admin/domains/warroom.xn--82c4af5bzdj.online/public_html
DEPLOY_PATH="$PWD" bash deploy.sh
```

This produces the `out/` build and swaps it into the doc root. Visit the
subdomain — you should see the War Room.

### 5. Wire up GitHub Actions

The workflow at [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
needs three secrets and two variables on the repo.

Use the same SSH key as juntraweb (already authorized on the server):

```bash
# from your laptop
gh secret set SSH_HOST          -R xjanova/Warroomjuntra -b "123.253.62.251"
gh secret set SSH_USER          -R xjanova/Warroomjuntra -b "admin"
gh secret set SSH_PRIVATE_KEY   -R xjanova/Warroomjuntra < ~/.ssh/thaixtrade_deploy

gh variable set DEPLOY_PATH -R xjanova/Warroomjuntra -b "/home/admin/domains/warroom.xn--82c4af5bzdj.online/public_html"
gh variable set APP_URL     -R xjanova/Warroomjuntra -b "https://warroom.xn--82c4af5bzdj.online"
```

> **Note:** `xjanova` is a User, not an Organization — secrets do NOT inherit
> from other repos. Set per-repo every time.

Push to `main` → GitHub Actions takes over.

---

## Subsequent deploys

Just push to `main`:

```bash
git push origin main
```

Or trigger manually:

```bash
gh workflow run deploy.yml -R xjanova/Warroomjuntra
```

Or SSH and run directly:

```bash
ssh admin@123.253.62.251 \
  "cd /home/admin/domains/warroom.xn--82c4af5bzdj.online/public_html && bash deploy.sh"
```

---

## What deploy.sh does

1. `git fetch --all && git reset --hard origin/main` — pull latest. No
   `git stash` (it ate `.env` and hand-placed shims on juntraweb's first
   deploy; lesson learned).
2. `npm ci` — install exact lockfile dependencies.
3. `npm run build` — Next.js produces `out/` (static export).
4. **Atomic swap** — copy `out/*` into a staging dir, then `mv` the known
   live files (`_next/`, `assets/`, `*.html`, `.htaccess`) into the doc
   root. The repo, `node_modules`, and `deploy.sh` itself stay in place.
5. Health check `$HEALTH_URL` if set.

---

## Troubleshooting

### "403 Forbidden" after first deploy
The `.htaccess` may not have been copied. Confirm `.htaccess.public` exists in
the repo (it does) and that `deploy.sh` step 4 ran. Manual fix:

```bash
cp .htaccess.public public_html_root/.htaccess  # adjust path
```

### "command not found: npm" in GitHub Actions
SSH host is missing Node on PATH. Add to `~/.bashrc`:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

The action uses a non-interactive shell so the `.bashrc` may not source. If
that happens, add explicit PATH at the top of `deploy.sh`:

```bash
export PATH="$HOME/.nvm/versions/node/v20.11.1/bin:$PATH"
```

### Build fails on the server but works locally
Usually a Node version skew. Check `node --version` on the server matches CI
(currently 20.x). Use `nvm use 20` if needed.

### Want to roll back
```bash
ssh admin@123.253.62.251 \
  "cd /home/admin/.../public_html && git reset --hard <previous-sha> && bash deploy.sh"
```
