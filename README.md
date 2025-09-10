# Developico-Timesheet

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/lfalacinski-3726s-projects/v0-developico-timesheet-ta)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/HW7B9onwWkj)

## Overview

Timesheet / dashboard (Next.js 14 + TypeScript + Tailwind). Mock data layer (`DataService`) gotowa do podłączenia prawdziwego źródła (np. Dataverse).

## Quick Start (pnpm)

```powershell
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
pnpm dev
```

Aplikacja: <http://localhost:3000>

## Production Build

```powershell
pnpm typecheck
pnpm lint
pnpm build
pnpm start
```

## Node / pnpm versions

Zalecane: Node 20 (patrz `.nvmrc`), pnpm >= 8.

## Env Vars

`NEXT_PUBLIC_USE_MOCK=true` (domyślnie) – używa danych mock. Ustawienie na `false` spowoduje błąd (brak implementacji backendu).

## Project Structure

```text
app/                 # Next.js App Router entry
components/          # UI i sekcje (dashboard, calendar, projects)
lib/                 # DataService + filter context
data/                # Dodatkowe mocki / interfejsy
types/               # Typy wspólne
```

## NPM Scripts

```powershell
pnpm dev        # Dev server
pnpm build      # Production build
pnpm start      # Run built app
pnpm lint       # ESLint
pnpm typecheck  # TypeScript checks
```

## Deployment

Live: <https://vercel.com/lfalacinski-3726s-projects/v0-developico-timesheet-ta>

### Azure App Service (Linux B1) Notes

Compatible with Node 20 LTS or 22 LTS. Current `engines` allow both (`20.x || 22.x`).

Recommended App Settings on Azure (Configuration > Application settings):

```bash
WEBSITES_PORT=3000              # App Service will route to this port
PORT=3000                       # Redundancy – Next.js uses this when provided
NODE_ENV=Production             # Azure capitalization tolerant, keep consistent
NEXT_PUBLIC_USE_MOCK=true       # Until real data source implemented
```

Startup command: (leave empty). Oryx detection will run the `start` script (`pnpm start` → `next start`).

If using a custom container later: expose 3000 and set `WEBSITES_PORT=3000`.

### Consistent Local Port

Dev script enforces `next dev -p 3000`. If port is busy, Next.js will error instead of auto-switching. Free the port or stop the conflicting process.

## Continue in v0

<https://v0.app/chat/projects/HW7B9onwWkj>

## How Sync Works

1. Edytujesz projekt w [v0.app](https://v0.app)
2. Deploy w interfejsie v0
3. Zmiany trafiają tutaj (repo)
4. Vercel buduje i publikuje najnowszą wersję

## Next Steps (suggested)

- Integracja realnego źródła danych
- Testy (Vitest + Testing Library)
- CI (lint + typecheck + build) w GitHub Actions
- Optymalizacja: RSC dla statycznych części

## User Avatars via Microsoft Graph

Endpoint `/api/avatar/[id]` pobiera zdjęcie użytkownika z Microsoft Graph (client credentials).

Wymagane uprawnienia aplikacji (App Registration > API permissions):
`User.ReadBasic.All` (czasem konieczne `User.Read.All`) + admin consent.

Użycie w komponencie:

```tsx
// Użyj aadObjectId (nie systemuserid) dla Graph
<img src={`/api/avatar/${consultant.aadObjectId}`} alt={consultant.name} className="h-8 w-8 rounded-full" />
```

Fallback: gdy 404 – pokaż inicjały lub placeholder.

