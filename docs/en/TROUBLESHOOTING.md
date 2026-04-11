# Troubleshooting

## Table of Contents

- [Local Development](#local-development)
- [Authentication](#authentication)
- [Dataverse](#dataverse)
- [API](#api)
- [UI / Browser](#ui--browser)
- [Build / Deploy](#build--deploy)
- [Tests](#tests)

---

## Local Development

### Port 3000 in use

```bash
# Windows
npx kill-port 3000
# or
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS / Linux
lsof -ti:3000 | xargs kill -9
```

### `pnpm install` fails

```bash
# Make sure corepack is enabled
corepack enable
corepack prepare pnpm@latest --activate

# Clear cache
pnpm store prune
rm -rf node_modules
pnpm install
```

### Missing environment variables

In development, the app works with default values. Zod validation warnings (lib/env.ts) are informational. In production, missing required variables cause a crash.

**Solution**: Copy `.env.example` to `.env.local` and fill in the values.

---

## Authentication

### Redirect loop after login

**Cause**: Invalid `NEXTAUTH_URL` or missing callback URL in app registration.

**Solution**:
1. Check `NEXTAUTH_URL` — must match the app URL
2. In Entra ID → App Registration → Authentication → add redirect URI: `https://yourdomain/api/auth/callback/azure-ad`

### Role not assigned ("Unauthorized")

**Cause**: User does not belong to admin or consultant groups, or groups claim is missing.

**Solution**:
1. Verify `ADMIN_GROUP_ID` and `CONSULTANT_GROUP_ID` have correct Object IDs
2. Verify groups are of **Security** type (not Microsoft 365 / Distribution)
3. Ensure **groups claim** is configured in Token Configuration
4. User must sign out and sign in again after being added to a group

### `AZURE_AD_CLIENT_SECRET is required`

In development, this is a warning — the app works with mock data. In production, create a secret in App Registration and add it to variables.

### Access token expired

Tokens are stored in a volatile store (in-memory). Server restart forces re-authentication. Tokens are automatically refreshed by MSAL.

---

## Dataverse

### `dataSource: "mock"` despite Dataverse configuration

**Cause**: `NEXT_PUBLIC_USE_MOCK=true` overrides Dataverse.

**Solution**: Set `NEXT_PUBLIC_USE_MOCK=false` and `DATAVERSE_ENABLED=true`.

### 401 Unauthorized from Dataverse

**Cause**: Invalid or expired Dataverse credentials.

**Solution**:
1. Check `DATAVERSE_CLIENT_ID` and `DATAVERSE_CLIENT_SECRET`
2. Ensure the app has a Security Role in Dataverse
3. Verify `DATAVERSE_URL` is correct (with `https://`)
4. Verify the tenant ID is correct

### 429 Too Many Requests from Dataverse

**Cause**: Exceeded Dataverse API request limits.

**Solution**: Built-in retry (exponential backoff) handles 429 automatically. If the issue persists:
1. Check logs — how many requests per minute?
2. Use client-side caching (enabled by default)
3. Reduce refresh frequency

### No data — empty responses

1. Check `GET /api/health` — status and dataSource
2. Verify entities in Dataverse have data (`statecode eq 0`)
3. Check field mapping — do `DATAVERSE_FIELD_*` variables match actual field names?

---

## API

### 400 Bad Request

**Cause**: Parameters did not pass Zod validation.

**Solution**: Check required parameters in `body` or `searchParams`:
- `timeentries`: requires `from` and `to` (YYYY-MM-DD format)
- `days-off`: requires `from` and `to`
- `project-team`: requires `projectId`

### 429 Too Many Requests (rate limiter)

**Cause**: Built-in rate limiter (middleware) rejected the request.

**Solution**: Wait for the time specified in the `Retry-After` header (seconds). In development, the rate limiter has higher limits.

### 501 Not Implemented

**Cause**: Data source does not support the operation (e.g., Mock doesn't have `getProjectTeam`).

**Solution**: Switch to Dataverse or use a different endpoint.

### CORS errors

**Cause**: The API is server-side and doesn't require CORS for its own domain. If you see CORS errors:

1. Check that you're not calling the API from a different domain
2. Check CSP in middleware — `connect-src` must include your domain

---

## UI / Browser

### Calendar doesn't display entries

1. Open DevTools → Network → check `timeentries` request
2. Check date range in query parameters
3. Does mock data have entries for the selected week?
4. Check client cache — may be returning stale data

### Dashboard KPI = 0

1. Check if there are time entries for the current month
2. Check `consultantId` in context (ViewingScope)
3. Open DevTools → Console → look for fetch errors

### Stale data after changes

The client cache uses TTL. To force a refresh:
1. Close and reopen the tab (resets sessionStorage)
2. Clear localStorage (`projects:v1`, `consultants:v1`)
3. Hard refresh: `Ctrl+Shift+R`

---

## Build / Deploy

### Standalone build fails

```bash
# Check variables for the build
pnpm build 2>&1 | tee build.log

# Check for type errors
pnpm typecheck
```

### Azure App Service — Application Error

1. Check logs: Azure Portal → App Service → Log stream
2. Ensure `NODE_ENV=production` is set
3. Check startup command: `node server.js`
4. Verify all required environment variables are set

### GitHub Actions deploy not working

1. Check secrets in Settings → Secrets and variables → Actions
2. `AZURE_WEBAPP_PUBLISH_PROFILE` must be current
3. Check workflow logs in the Actions tab

---

## Tests

### Vitest doesn't start

```bash
# Check configuration
pnpm vitest --version
pnpm typecheck
```

### Playwright timeouts

```bash
# Install browsers
pnpx playwright install

# Run with debug
pnpm test:e2e -- --debug

# Increase timeout in playwright.config.ts
```

### Snapshot mismatch

```bash
# Update snapshots
pnpm vitest --update
```
