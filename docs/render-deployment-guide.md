# Render Deployment Guide

How to set up Render instances for each category branch. Includes known issues and fixes from the initial production deployment.

---

## Prerequisites

### Update All Category Branches First

The category branches were created before several critical fixes were pushed to `master`. **Every branch must be rebased before deploying.** Without this, you'll hit the same AWS SSM, build script, and seed data issues that were already fixed.

```bash
# For each category branch:
git checkout cat5-test-coverage
git rebase master
git push --force-with-lease

git checkout cat2-bundle-size
git rebase master
git push --force-with-lease

git checkout cat3-api-response-time
git rebase master
git push --force-with-lease

git checkout cat4-db-query-efficiency
git rebase master
git push --force-with-lease

git checkout cat1-type-safety
git rebase master
git push --force-with-lease

git checkout cat6-runtime-error-handling
git rebase master
git push --force-with-lease

git checkout cat7-accessibility
git rebase master
git push --force-with-lease
```

Fixes included in `master` that the branches need:
- **`SKIP_SSM` flag** (`b655e54`) — without this, the API crashes on startup with `CredentialsProviderError` because Render is not AWS
- **`VITE_API_URL` build fix** (`09524a2`) — without this, the web build overrides the API URL to empty string, causing all API calls to go to the web domain
- **Expanded seed data** (`710f83b`) — 501 docs, 218 issues, 22 users, 35 sprints
- **CLAUDE.md + category docs** (`710f83b`) — rules and templates for each session

---

## Architecture Per Category

Each category gets its own set of Render services so they can be tested independently:

| Service | Type | Branches That Need It |
|---------|------|-----------------------|
| API | Web Service | All categories |
| Web | Static Site | Cat 2, 6, 7 (frontend changes). Optional for Cat 1, 3, 4, 5 |
| Working DB | PostgreSQL | Shared across all categories |
| Baseline DB | PostgreSQL | One instance, never modified, for benchmark comparisons |

Categories 3, 4, and 5 are backend-only changes — you can skip the web static site for those if you want to save Render resources. Just use the existing production web pointing at the category's API.

---

## Setting Up the API (Web Service)

### Create Service

1. **New Web Service** in Render
2. Connect your GitHub repo
3. Set the **branch** to the category branch (e.g., `cat5-test-coverage`)

### Build & Start Settings

| Setting | Value |
|---------|-------|
| **Runtime** | Node |
| **Build Command** | `pnpm install && pnpm build:shared && cd api && pnpm build && node dist/db/migrate.js` |
| **Start Command** | `node api/dist/index.js` |

### Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `CORS_ORIGIN` | `https://shipshape-cat{N}-web.onrender.com` | Must match the exact web URL (no trailing slash) |
| `DATABASE_URL` | *(Internal Database URL from Render PostgreSQL dashboard)* | Shared Working DB — copy from your PostgreSQL instance's **Info** tab |
| `NODE_ENV` | `production` | Required for SSL, secure cookies, etc. |
| `SESSION_SECRET` | *(generate a random string)* | Any secure random value, e.g., `openssl rand -hex 32` |
| `SKIP_SSM` | `true` | **Critical.** Without this, startup crashes with `CredentialsProviderError` trying to reach AWS SSM |

> **Replace `cat{N}` with the category number.** For example, Category 5 uses `https://shipshape-cat5-web.onrender.com` and `https://shipshape-cat5-api.onrender.com`.

### Known Issues

**`CredentialsProviderError: Could not load credentials from any providers`**
- **Cause:** The API tries to load secrets from AWS SSM Parameter Store on startup
- **Fix:** Set `SKIP_SSM=true` in environment variables. This was added in commit `b655e54`

**`Cannot find module '/opt/render/project/src/dist/index.js'`**
- **Cause:** Render runs the start command from the project root, but the compiled output is in `api/dist/`
- **Fix:** Start command must be `node api/dist/index.js` (path from project root)

**`npm error code EUNSUPPORTEDPROTOCOL` during build**
- **Cause:** Render auto-detects npm, but the project uses pnpm with `workspace:*` protocol
- **Fix:** The build command must use `pnpm install`, not `npm install`. Render detects pnpm from `pnpm-lock.yaml` if you use `pnpm install` as the build command

---

## Setting Up the Web (Static Site)

### Create Service

1. **New Static Site** in Render
2. Connect your GitHub repo
3. Set the **branch** to the category branch

### Build Settings

| Setting | Value |
|---------|-------|
| **Build Command** | `npm i -g pnpm@10.27.0 && pnpm install && pnpm --filter @ship/shared build && pnpm --filter @ship/web build` |
| **Publish Directory** | `dist` |

### Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `SKIP_INSTALL_DEPS` | `true` | Prevents Render from auto-installing with npm |
| `VITE_API_URL` | `https://shipshape-cat{N}-api.onrender.com` | **Build-time only.** Baked into the JS bundle at build |
| `VITE_WS_URL` | `https://shipshape-cat{N}-api.onrender.com` | WebSocket URL for real-time collaboration |

> **Replace `cat{N}` with the category number.** For example, Category 5: `https://shipshape-cat5-api.onrender.com`.

### Rewrite Rules

Add this rewrite rule in Render's Static Site settings (under "Redirects/Rewrites"):

| Source | Destination | Action |
|--------|-------------|--------|
| `/*` | `/index.html` | Rewrite |

This is required for SPA client-side routing. Without it, refreshing any page other than `/` returns a 404.

### Known Issues

**Blank page after deploy (API calls going to wrong domain)**
- **Cause:** The old build script in `web/package.json` had `VITE_API_URL= vite build` which set the variable to empty string, overriding whatever Render set
- **Fix:** Already fixed in commit `09524a2`. The build script is now just `tsc && vite build`. Make sure your branch has this fix (rebase from master)

**`npm error code EUNSUPPORTEDPROTOCOL` during build**
- **Cause:** Same as API — `workspace:*` is a pnpm protocol
- **Fix:** Build command must use `pnpm install`. Do NOT use `cd web && npm run build`

**Build fails with `cd: web: No such file or directory`**
- **Cause:** Using `cd web &&` in the build command after pnpm install changes cwd
- **Fix:** Use `pnpm --filter` syntax instead: `pnpm --filter @ship/shared build && pnpm --filter @ship/web build`

---

## Setting Up PostgreSQL

### Working DB

1. **New PostgreSQL** in Render
2. Note the **Internal Database URL** — this is your `DATABASE_URL` for API instances
3. After the API deploys, run the seed: connect to the API instance's shell and run `pnpm db:seed`
   - Or set up a one-time job to seed

The Working DB is shared across all category branches. This is safe because:
- Categories 1, 2, 3, 5, 6, 7 make zero schema changes
- Category 4 only adds 2 indexes (additive, non-destructive)

### Baseline DB

1. **New PostgreSQL** in Render (separate instance)
2. Seed it once with the master branch code
3. **Never modify it.** This exists solely for re-running benchmarks against the original codebase for comparison

---

## Seeding the Database

After the API deploys and connects to a fresh PostgreSQL instance:

```bash
# From the Render shell (API service → Shell tab):
pnpm db:migrate
pnpm db:seed
```

The seed script produces: 501 documents, 218 issues, 22 users, 35 sprints.

You only need to seed once per database. The Working DB persists across branch deploys.

---

## Deploying a New Category

Quick checklist for spinning up a category (replace `{N}` with category number):

1. [ ] Rebase the category branch from `master`: `git rebase master && git push --force-with-lease`
2. [ ] Create (or update) the API Web Service pointing to the category branch
3. [ ] Set API env vars: `CORS_ORIGIN`, `DATABASE_URL`, `NODE_ENV=production`, `SESSION_SECRET`, `SKIP_SSM=true`
4. [ ] Create the Web Static Site if needed (Cat 2, 6, 7 have frontend changes)
5. [ ] Set Web env vars: `SKIP_INSTALL_DEPS=true`, `VITE_API_URL`, `VITE_WS_URL`
6. [ ] Add `/* → /index.html` rewrite rule on the Static Site
7. [ ] Verify API health: `curl https://shipshape-cat{N}-api.onrender.com/api/setup/status`
8. [ ] Verify Web loads and API calls reach the correct domain (check Network tab)
9. [ ] Run the category's specs, test, benchmark
10. [ ] When done: merge to master, rebase the next category branch, repeat

---

## Cost Optimization

If you don't want to run 7 parallel API instances:

- **Reuse one API + Web pair.** Change the branch in Render settings and redeploy. This is slower (redeploy per category) but costs nothing extra.
- **Skip Web for backend-only categories.** Cat 1, 3, 4, 5 don't change frontend code. Use the existing production web or test via curl/Postman.
- **Free tier limits.** Render free PostgreSQL has a 1GB storage limit and spins down after 15 minutes of inactivity. The seed data fits well within 1GB, but cold starts add ~30s to the first request.
