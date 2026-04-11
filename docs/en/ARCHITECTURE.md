# System Architecture

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Architecture Diagram](#architecture-diagram)
- [Presentation Layer](#presentation-layer)
- [API Layer](#api-layer)
- [Data Layer](#data-layer)
- [Authentication & Authorization](#authentication--authorization)
- [Middleware](#middleware)
- [Client Cache](#client-cache)
- [Logging](#logging)

## Overview

Developico Timesheet is a web application built with Next.js 14 (App Router + Pages Router) and TypeScript for time tracking and project management. It communicates with Microsoft Dataverse (CRM) as the data backend and Microsoft Graph API for user information.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14.2 (App Router + Pages Router hybrid) |
| Language | TypeScript 5.0 (strict mode) |
| UI | React 18.3 + shadcn/ui + Radix UI |
| Styles | Tailwind CSS 4.1 |
| Authentication | NextAuth.js 4.24 + @azure/msal-node 3.7 |
| Validation | Zod 3.25 |
| Testing | Vitest 4.0 (unit) + Playwright 1.58 (E2E) |
| Package manager | pnpm 10 |
| Deployment | Azure App Service (Linux, standalone output) |
| CI/CD | GitHub Actions |

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                    Browser                       │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Dashboard  │  │ Calendar │  │   Reports    │ │
│  └─────┬─────┘  └────┬─────┘  └──────┬───────┘ │
│        └──────────────┼───────────────┘         │
│              ┌────────┴────────┐                │
│              │  Client Cache   │                │
│              │  (TTL + SWR)    │                │
│              └────────┬────────┘                │
└───────────────────────┼─────────────────────────┘
                        │ HTTPS
┌───────────────────────┼─────────────────────────┐
│               Next.js Server                     │
│  ┌────────────────────┴──────────────────────┐  │
│  │           Middleware                       │  │
│  │   (CSP, HSTS, Rate Limiting)              │  │
│  └────────────────────┬──────────────────────┘  │
│  ┌──────────┐  ┌──────┴──────┐  ┌───────────┐  │
│  │ NextAuth │  │  API Routes │  │   SSR /    │  │
│  │ (Entra   │  │  /api/*     │  │   RSC      │  │
│  │   ID)    │  └──────┬──────┘  └───────────┘  │
│  └──────────┘         │                         │
│              ┌────────┴────────┐                │
│              │  IDataSource    │                │
│              │  (Interface)    │                │
│              ├─────────┬──────┤                │
│              │  Mock   │  DV  │                │
│              └─────────┴──┬───┘                │
└───────────────────────────┼─────────────────────┘
                            │ OAuth 2.0
              ┌─────────────┼─────────────┐
              │  Microsoft Dataverse      │
              │  Microsoft Graph API      │
              │  Entra ID                 │
              └───────────────────────────┘
```

## Presentation Layer

### Pages (App Router)

| Path | Description |
|------|-------------|
| `/` | Home page (redirect to dashboard) |
| `/dashboard` | KPI dashboard with cards, charts, project table |
| `/calendar` | Weekly calendar view with time registration |
| `/projects` | Project list with filters and detail panel |
| `/reports` | Report builder with filters and export |

### Components

The app uses **shadcn/ui** components (Radix UI + Tailwind) organized in:

- `components/ui/` — primitives (Button, Dialog, Select, Toast, etc.)
- `components/dashboard/` — KPI cards, charts
- `components/calendar/` — calendar widgets
- `components/projects/` — tables, detail panels
- `components/admin/` — ConsultantDock, ViewingBanner
- `components/layout/` — Navbar, FilterBar, NavigationTabs

### CSS Strategy

Instead of inline `style={{...}}`, the project uses:

1. `data-*` attributes as semantic selectors
2. A single consolidated `<style id="app-dynamic-styles">` tag (via `useAggregatedDynamicCss` hook)
3. CSS custom properties (`--seg-0`, `--seg-1`) for animations and positioning

## API Layer

REST endpoints in `app/api/`:

| Path | Method | Description | Auth |
|------|--------|-------------|------|
| `/api/health` | GET | Health check (status, data source) | No |
| `/api/me` | GET | Current user profile | Yes |
| `/api/me/photo` | GET | User photo (Graph) | Yes |
| `/api/dataverse/consultants` | GET | List consultants | Yes |
| `/api/dataverse/projects` | GET | List projects | Yes |
| `/api/dataverse/timeentries` | GET | Time entries (filtered) | Yes |
| `/api/dataverse/project-assignments` | GET | Consultant assignments | Yes |
| `/api/dataverse/project-team` | GET | Project team members | Yes |
| `/api/dataverse/days-off` | GET | Holidays in date range | Yes |
| `/api/graph/consultants` | GET | Consultants from AD group | Yes |
| `/api/graph/users/[id]/photo` | GET | User photo by ID | Yes |
| `/api/reports/data` | GET | Report data (aggregation) | Admin |
| `/api/reports/pdf` | POST | Export report as PDF | Admin |

### API Guards

- `requireAuth(req)` — verifies JWT from NextAuth, returns token and OID
- `isAuthError(auth)` — checks if auth returned an error (401/403)
- Parameter validation: Zod schemas (400 on invalid data)
- Correlation: each request gets a `cid` (correlation ID)

## Data Layer

### `IDataSource` Interface

```typescript
interface IDataSource {
  getConsultants(): Promise<Consultant[]>
  getProjects(currentConsultantId?: string): Promise<Project[]>
  getTimeEntries(params: TimeEntryFilters): Promise<TimeEntry[]>
  getProjectAssignments?(consultantId: string): Promise<string[]>
  getProjectTeam?(projectId: string): Promise<string[]>
  getDaysOff?(from: string, to: string): Promise<{ date: string; name?: string }[]>
}
```

### Implementations

| Source | File | Description |
|--------|------|-------------|
| **Mock** | `data/mock.ts` | Test data, active by default (`NEXT_PUBLIC_USE_MOCK=true`) |
| **Dataverse** | `data/dataverse.ts` | Microsoft Dataverse (CRM) via OData v4.0 |

### Factory

`data/source.ts` — selects implementation based on `NEXT_PUBLIC_USE_MOCK`.

### Dataverse Client

`lib/dataverse-client.ts` — `DataverseClient` class:

- Retry logic: 429/503 with exponential backoff (up to 3 attempts)
- Pagination: automatic `@odata.nextLink` tracking
- Token: OAuth 2.0 client credentials (MSAL)
- Field configuration: `lib/dataverse-config.ts` (all logical names from env vars)

## Authentication & Authorization

### Flow

1. User signs in via Azure AD (OAuth 2.0 Authorization Code)
2. NextAuth.js processes callback, extracts groups from `id_token`
3. Roles mapped: Admin group → `Administrator`, Consultant group → `Consultant`
4. Access token → volatile store (in-memory, encrypted)
5. Session JWT → httpOnly cookie

### Roles

| Role | Permissions |
|------|-------------|
| `Administrator` | Full access (CRUD + reports + impersonation) |
| `Consultant` | Read/write own data |
| `Unauthorized` | No access (no matching group) |

### Impersonation

Administrators can switch view to any consultant (ConsultantDock). Context stored in `ViewingScopeContext` (sessionStorage).

## Middleware

`middleware.ts` applies to all responses:

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | Strict defaults + exceptions for Next.js/Tailwind |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

### Rate Limiting

Rate limiter (sliding window, in-memory) on `/api/*` routes:

- Auth routes: higher limit
- Other routes: standard limit
- 429 response with `Retry-After` header
- Automatic cleanup of expired entries

## Client Cache

`lib/client-cache.ts` implements TTL + Stale-While-Revalidate pattern:

| Data | Fresh TTL | Stale window |
|------|-----------|--------------|
| Projects | 15 min | 2 h |
| Consultants | 15 min | 2 h |
| Days Off | 12 h | 7 days |
| Time Entries | 30 s | 5 min |

### Mechanism

1. Fresh data (within TTL) → immediate return
2. Stale data (past TTL, within window) → return + background refresh
3. Missing or expired → normal fetch

### Prefetch

`ClientRoot` on mount parallelly fetches `projects` and `consultants`.

### localStorage

Selected prefixes (`projects:v1`, `consultants:v1`, `daysoff:v1`) persisted in `localStorage`.

## Logging

`lib/app-logger.ts` — structured logging:

- Levels: `debug`, `info`, `warn`, `error`
- Automatic PII redaction (tokens, email, secrets)
- Request correlation (`cid`)
- Modes: `console` (default), `file`, `silent` (env `LOG_MODE`)
