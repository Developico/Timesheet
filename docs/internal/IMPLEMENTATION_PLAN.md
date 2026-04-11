# Developico Timesheet — Plan realizacji poprawek

> **Opracowano na podstawie:** [AUDIT.md](AUDIT.md) z dnia 2026-03-06  
> **Metodyka:** 4 fazy realizacji, priorytet od najwyższego ryzyka do usprawnień jakościowych  
> **Szacowany łączny zakres:** ~17 zadań pogrupowanych w 4 fazy  

---

## Spis treści

1. [Faza 1 — Bezpieczeństwo (Krytyczne)](#faza-1--bezpieczeństwo-krytyczne)
2. [Faza 2 — Stabilizacja i niezawodność](#faza-2--stabilizacja-i-niezawodność)
3. [Faza 3 — Testy](#faza-3--testy)
4. [Faza 4 — Refactoring i jakość](#faza-4--refactoring-i-jakość)
5. [Backlog (nice-to-have)](#backlog-nice-to-have)
6. [Harmonogram](#harmonogram)
7. [Definition of Done](#definition-of-done)

---

## Faza 1 — Bezpieczeństwo (Krytyczne)

Celem fazy jest zamknięcie wszystkich podatności oznaczonych jako 🔴 i najważniejszych 🟡.  
**Zasada:** brak zmian funkcjonalnych — wyłącznie hardening.

---

### 1.1 Nagłówki bezpieczeństwa HTTP

**Ref audytu:** K2  
**Pliki:** `middleware.ts` (nowy), `next.config.mjs`

**Zakres:**
- Utworzyć `middleware.ts` w katalogu głównym projektu
- Ustawić nagłówki na WSZYSTKICH odpowiedziach:

| Nagłówek | Wartość |
|----------|---------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | Polityka dopasowana do aplikacji (self, inline styles dla Tailwind, graph.microsoft.com, login.microsoftonline.com) |

**Kroki:**
1. Utworzyć `middleware.ts` z funkcją ustawiającą nagłówki via `NextResponse.next()`
2. Skonfigurować `matcher` tak, aby obejmował wszystkie trasy oprócz `_next/static`
3. Przetestować, czy login Azure AD, pobieranie zdjęć Graph i Dataverse działają poprawnie z CSP
4. Iteracyjnie dostosować CSP (report-only na początek, potem enforce)

**Weryfikacja:** Narzędzie https://securityheaders.com lub `curl -I` na wdrożonej wersji

---

### 1.2 Zunifikowany auth guard na endpointach API

**Ref audytu:** K4, W1  
**Pliki:** nowy `lib/api-auth-guard.ts`, wszystkie pliki `app/api/dataverse/*/route.ts`

**Zakres:**
- Wyodrębnić wspólną funkcję `requireAuth(req: NextRequest)` zwracającą dane sesji lub NextResponse 401
- Zastosować we WSZYSTKICH route handlerach `/api/dataverse/*`
- Endpointy `consultants`, `days-off` — dodać brakującą weryfikację

**Kroki:**
1. Utworzyć `lib/api-auth-guard.ts`:
   ```typescript
   export async function requireAuth(req: NextRequest): Promise<
     { ok: true; token: JWT } | { ok: false; response: NextResponse }
   >
   ```
2. Zrefaktorować każdy route handler — zamienić ręczne `getToken()` + `if (!token)` na wywołanie `requireAuth()`
3. Upewnić się, że `/api/health` pozostaje publiczny (jedyny wyjątek)
4. Dodać testy na scenariusze 401

**Weryfikacja:** Test manualny `curl` bez cookie → HTTP 401 na wszystkich chronionych endpointach

---

### 1.3 Rate limiting na API routes

**Ref audytu:** K3  
**Pliki:** `middleware.ts` (rozszerzenie z 1.1), nowy `lib/rate-limiter.ts`

**Zakres:**
- Implementacja in-memory sliding window rate limiter
- Limit: 600 req/min per IP na `/api/*` (użytkownicy biurowi często dzielą ten sam IP korporacyjny — limit musi być bezpieczny dla wielu osób za jednym NAT-em)
- Osobny niższy limit na `/api/auth/*` (30 req/min — ochrona przed brute force, ale z marginesem na retry logowania)

**Kroki:**
1. Utworzyć `lib/rate-limiter.ts` z `Map<string, { count, windowStart }>`
2. Podpiąć w middleware (`middleware.ts`) jako wczesny check przed nagłówkami
3. Zwracać `429 Too Many Requests` z nagłówkiem `Retry-After`
4. Dodać cleanup interval (co 60s usuwanie wygasłych wpisów)

**Uwagi:**
- In-memory wystarczy dla single-instance deployment (Azure App Service B1/S1)
- Przy skalowaniu horyzontalnym: przejść na Redis-backed rate limiter lub Azure API Management
- **Ważne:** Użytkownicy biurowi w sieci korporacyjnej często dzielą publiczny IP (NAT). Limit musi być wystarczająco wysoki, aby nie blokować normalnej pracy wielu osób. 600 req/min per IP to ~10 req/s, co spokojnie pokrywa nawet kilkudziesięciu użytkowników za jednym IP.

---

### 1.4 Włączenie walidacji TypeScript/ESLint w buildzie

**Ref audytu:** K1  
**Pliki:** `next.config.mjs`

**Zakres:**
- Usunąć `eslint.ignoreDuringBuilds: true`
- Usunąć `typescript.ignoreBuildErrors: true`
- Naprawić wszystkie błędy type/lint blokujące build

**Kroki:**
1. Uruchomić `pnpm typecheck` — zebrać listę błędów
2. Uruchomić `pnpm lint` — zebrać listę błędów
3. Naprawić wszystkie błędy (przed usunięciem flag)
4. Usunąć flagi z `next.config.mjs`
5. Potwierdzić `pnpm build` kończy się sukcesem

**Uwaga:** To zadanie może ujawnić ukryte błędy typów. Realizować PO zadaniu 1.2 (zunifikowany guard może zmienić sygnatury).

---

### 1.5 Przeniesienie group IDs do zmiennych server-only

**Ref audytu:** W3  
**Pliki:** `.env.production.template`, `.env.example`, `pages/api/auth/[...nextauth].ts`, pliki klienckie odwołujące się do `NEXT_PUBLIC_ADMIN_GROUP` / `NEXT_PUBLIC_CONSULTANT_GROUP`

**Zakres:**
- Zmienić `NEXT_PUBLIC_ADMIN_GROUP` → `ADMIN_GROUP_ID`
- Zmienić `NEXT_PUBLIC_CONSULTANT_GROUP` → `CONSULTANT_GROUP_ID`
- W kodzie klienckim: role pobierać z sesji (są już tam populowane przez JWT callback), NIE z env var

**Kroki:**
1. Grep wszystkich wystąpień `NEXT_PUBLIC_ADMIN_GROUP` / `NEXT_PUBLIC_CONSULTANT_GROUP`
2. W `[...nextauth].ts` — zmienić referencje na nowe nazwy
3. W kodzie klienckim — usunąć bezpośrednie odwołania do tych env vars; korzystać z `user.role` / `user.roles` z `useAuth()`
4. Zaktualizować `.env.example` i `.env.production.template`
5. Zaktualizować dokumentację w `.env.production.template`

**Weryfikacja:** `pnpm build` → sprawdzić, że bundle klienta nie zawiera GUID grup (`grep` na `.next/static/`)

---

### 1.6 Hardening OData queries (zapobieganie injection)

**Ref audytu:** W2  
**Pliki:** `data/dataverse.ts`, nowy `lib/odata-sanitizer.ts`

**Zakres:**
- Utworzyć moduł z helperami do bezpiecznego budowania filtrów OData
- Zapewnić, że KAŻDY parametr jest walidowany i quotowany zanim trafi do filtra

**Kroki:**
1. Utworzyć `lib/odata-sanitizer.ts`:
   ```typescript
   export function odataGuid(value: string): string   // walidacja GUID + quote
   export function odataString(value: string): string  // escape single-quotes + quote
   export function odataDate(value: string): string    // walidacja ISO date
   ```
2. Zamienić ręczne budowanie filtrów w `data/dataverse.ts` na wywołania helperów
3. Usunąć bezpośrednie konkatenacje parametrów w filtrze OData

**Weryfikacja:** Testy jednostkowe helperów + test z payload'em `'; drop --` → poprawny escape

---

## Faza 2 — Stabilizacja i niezawodność

Celem fazy jest wzmocnienie konfiguracji, poprawa niezawodności i porządek w zależnościach.

---

### 2.1 Walidacja zmiennych środowiskowych na starcie

**Ref audytu:** W6 / sekcja 5  
**Pliki:** nowy `lib/env.ts`, `app/layout.tsx` lub `instrumentation.ts`

**Zakres:**
- Zod schema walidujący WYMAGANE env vars przy starcie serwera
- Fail-fast: jeśli brakuje krytycznej zmiennej → czytelny komunikat + `process.exit(1)`

**Kroki:**
1. Utworzyć `lib/env.ts` z Zod schema:
   - Wymagane: `NEXTAUTH_SECRET`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`
   - Opcjonalne (z default): `DATAVERSE_ENABLED`, `LOG_MODE`, `VOLATILE_STORE_PERSIST`
   - Warunkowe: jeśli `DATAVERSE_ENABLED=true` → wymagane `DATAVERSE_URL`, `DATAVERSE_CLIENT_ID`, `DATAVERSE_CLIENT_SECRET`
2. Zaimportować i walidować w `instrumentation.ts` (Next.js instrumentation hook) lub jako top-level w pierwszym server module
3. Wyeksportować typed env object: `export const env = envSchema.parse(process.env)`
4. Zamienić `process.env.XXX` na `env.XXX` w modułach serwerowych

---

### 2.2 Przypiąć wersje zależności (`latest` → konkretne)

**Ref audytu:** sekcja 4.2 Niespójności  
**Pliki:** `package.json`

**Zakres:**
- Zamienić `"latest"` na konkretne wersje z aktualnego lockfile
- Dotyczy: `@radix-ui/react-checkbox`, `@radix-ui/react-progress`, `@radix-ui/react-slot`, `next-themes`

**Kroki:**
1. `pnpm list @radix-ui/react-checkbox next-themes @radix-ui/react-progress @radix-ui/react-slot` → odczytać bieżące wersje
2. Zaktualizować `package.json` — zamienić `"latest"` na `"^X.Y.Z"`
3. Uruchomić `pnpm install` → potwierdzić brak zmian w lockfile (wersje się nie zmieniły)

---

### 2.3 Audyt nieużywanych zależności

**Ref audytu:** sekcja 4.2 Zarządzanie zależnościami  
**Pliki:** `package.json`

**Zakres:**
- Uruchomić `npx depcheck` i przeanalizować raport
- Kandydaci do usunięcia: `@vercel/analytics`, `autoprefixer`, duplikacja `tailwindcss-animate` + `tw-animate-css`
- Sprawdzić każdy pakiet Radix UI — czy jest importowany

**Kroki:**
1. `npx depcheck --ignores="@types/*,eslint*,postcss,tailwindcss"`
2. Dla każdej flagi "unused" — zweryfikować ręcznie (grep import/require)
3. Usunąć potwierdzone unused → `pnpm install` → `pnpm build`
4. Naprawić rozbieżność `eslint-config-next` (15.x) vs `next` (14.x) — downgrade eslint-config-next do 14.x

---

### 2.4 Włączyć React Strict Mode

**Ref audytu:** W4  
**Pliki:** `next.config.mjs`

**Kroki:**
1. Ustawić `reactStrictMode: true`
2. Uruchomić dev server → zweryfikować brak double-render artefaktów
3. Jeśli problemy z effectami (np. double fetch) — naprawić hooki (idempotentny cleanup)

---

### 2.5 Porządek w nazewnictwie i zbędnym kodzie

**Ref audytu:** sekcja 4.2 Nazewnictwo  
**Pliki:** `package.json`, `scripts/`, `hooks/`

**Kroki:**
1. Zmienić `name` w `package.json`: `"my-v0-project"` → `"developico-timesheet"`
2. Usunąć pusty `scripts/apply-env-to-appservice.ps1` (lub zaimplementować)
3. Usunąć `disable-fast-refresh.js` (redundantny w Next.js 14)
4. Zbadać `useUltraStablePanelState` vs `useStablePanelState` — jeśli duplikacja, zunifikować

---

## Faza 3 — Testy

Celem fazy jest osiągnięcie minimalnego pokrycia testowego.

---

### 3.1 Konfiguracja Vitest

**Pliki:** `vitest.config.ts` (nowy lub aktualizacja), `package.json`

**Kroki:**
1. Zainstalować: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom`
2. Skonfigurować `vitest.config.ts`:
   ```typescript
   import { defineConfig } from 'vitest/config'
   import react from '@vitejs/plugin-react'
   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'jsdom',
       globals: true,
       setupFiles: ['./tests/setup.ts'],
       coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
     },
     resolve: { alias: { '@': '.' } },
   })
   ```
3. Utworzyć `tests/setup.ts` z importem `@testing-library/jest-dom`
4. Dodać skrypty w `package.json`:
   ```json
   "test": "vitest run",
   "test:watch": "vitest",
   "test:coverage": "vitest run --coverage"
   ```

---

### 3.2 Testy warstwy danych (najwyższy priorytet)

**Pliki:** nowe pliki w `tests/`

| Plik testowy | Co testuje | Priority |
|-------------|-----------|----------|
| `tests/lib/metrics.test.ts` | `calculateKPIMetrics`, `calculateProjectMetrics`, `getWorkingDays` | 🔴 |
| `tests/lib/time-entries-summary.test.ts` | `summarize`, `isAbsenceProject`, `formatHours` | 🔴 |
| `tests/lib/odata-sanitizer.test.ts` | Sanityzacja GUID, string, date (z fazy 1.6) | 🔴 |
| `tests/lib/client-cache.test.ts` | TTL, stale, invalidation, deduplication | 🟡 |
| `tests/lib/env.test.ts` | Walidacja env vars (z fazy 2.1) | 🟡 |
| `tests/lib/dataverse-user-map.test.ts` | Mapowanie AAD → DV, cache, walidacja GUID | 🟡 |

**Podejście:**
- Moduły czysto logiczne (`metrics.ts`, `time-entries-summary.ts`) — testy bezpośrednie, bez mocków
- Moduły z fetch/external calls (`dataverse-user-map.ts`, `client-cache.ts`) — mockować fetch/timery

---

### 3.3 Testy API routes

**Pliki:** nowe pliki w `tests/api/`

| Plik testowy | Co testuje |
|-------------|-----------|
| `tests/api/health.test.ts` | Health check — poprawna odpowiedź |
| `tests/api/me.test.ts` | 200 z tokenem, 401 bez tokenu |
| `tests/api/timeentries.test.ts` | Walidacja Zod params, 401, 200 z mock data |
| `tests/api/consultants.test.ts` | Auth gate (post faza 1.2) |

**Podejście:**
- Mockować `getToken()` (NextAuth) i `dataSource` (IDataSource)
- Testować walidację wejścia i kody statusu

---

---

## Faza 4 — Refactoring i jakość

Celem fazy jest poprawa utrzymywalności kodu bez zmian funkcjonalnych.

---

### 4.1 Rozbicie dużych komponentów

**Zakres i plan:**

#### `calendar-view.tsx` → moduły:
| Nowy moduł | Odpowiedzialność |
|------------|------------------|
| `hooks/use-calendar-navigation.ts` | Nawigacja miesiąc/tydzień, swipe gestures |
| `hooks/use-calendar-data.ts` | Agregacja wpisów per dzień, absence detection |
| `components/calendar/calendar-grid.tsx` | Render siatki kalendarza |
| `components/calendar/calendar-day-cell.tsx` | Pojedyncza komórka dnia |

#### `projects-table.tsx` → moduły:
| Nowy moduł | Odpowiedzialność |
|------------|------------------|
| `hooks/use-projects-sorting.ts` | Logika sortowania kolumn |
| `hooks/use-projects-filtering.ts` | Scope + billable + "only reported" filtry |
| `components/projects/column-visibility-toggle.tsx` | UI przełącznika kolumn |

#### `data/dataverse.ts` → moduły:
| Nowy moduł | Odpowiedzialność |
|------------|------------------|
| `data/dataverse-consultants.ts` | `getConsultants()` + retry logic |
| `data/dataverse-projects.ts` | `getProjects()` + assignment logic |
| `data/dataverse-time-entries.ts` | `getTimeEntries()` + pagination |
| `data/dataverse-common.ts` | Shared helpers (field fallback, error handling) |

**Metoda:** Każdy refactor to osobny PR. Przed zmianą: testy (faza 3). Po zmianie: testy przechodzą + `pnpm build OK`.

---

### 4.2 Skonsolidowany logger

**Pliki:** `lib/app-logger.ts` (rozbudowa), usunięcie `lib/server-log.ts`, refactor `[...nextauth].ts`

**Zakres:**
- Jeden moduł logowania: `lib/logger.ts`
- Eksportuje: `logger.info()`, `logger.error()`, `logger.debug()`, `logger.warn()`
- `createLogger(ctx)` — do tworzenia child loggerów z kontekstem (cid, route)
- Redakcja tokenów — jedna implementacja
- NextAuth logger: adapter korzystający z głównego loggera

---

### 4.3 Standaryzacja odpowiedzi błędów API

**Pliki:** nowy `lib/api-response.ts`, wszystkie route handlers

**Zakres:**
- Standardowy format:
  ```typescript
  interface ApiError {
    error: string       // user-friendly message
    code?: string       // maszynowy kod błędu (np. "AUTH_REQUIRED", "VALIDATION_FAILED")
    details?: unknown   // opcjonalne szczegóły (dev only)
  }
  ```
- Helper functions:
  ```typescript
  export function apiError(status: number, error: string, code?: string): NextResponse
  export function apiSuccess<T>(data: T): NextResponse
  ```
- Zastosować we wszystkich route handlerach

---

### 4.4 Wyodrębnienie magic numbers do stałych

**Pliki:** nowy `lib/constants.ts`, hooki i komponenty z hardcoded values

**Zakres:**
```typescript
// lib/constants.ts
export const CACHE_TTL_MS = 15 * 60_000          // 15 min
export const CACHE_STALE_WINDOW_MS = 2 * 60 * 60_000  // 2h
export const RECENT_CONSULTANTS_MAX = 5
export const NEW_PROJECT_WINDOW_DAYS = 15
export const COOKIE_EXPIRY_DAYS = 180
export const RATE_LIMIT_WINDOW_MS = 60_000
export const RATE_LIMIT_MAX_REQUESTS = 600
export const RATE_LIMIT_AUTH_MAX_REQUESTS = 30
```

---

## Backlog (nice-to-have)

Poniższe zadania nie są krytyczne, ale warto je zaplanować w przyszłych iteracjach:

| # | Zadanie | Uzasadnienie |
|---|---------|-------------|
| B1 | Integracja z Azure Key Vault dla rotacji sekretów | S5 — eliminuje ręczne zarządzanie secretami |
| B2 | Optymalizacja obrazów (`images.unoptimized: false` + loader) | Poprawa performance |
| B3 | Przejście na NextAuth v5 (Auth.js) + App Router native | Eliminacja `pages/api/auth/` compatibility layer |
| B4 | Dodanie testów E2E (Playwright) | Krytyczne user flows (logowanie → dashboard → kalendarz) |
| B5 | Konfiguracja CORS z whitelistą domen | S2 — jawna polityka cross-origin |
| B6 | Redukcja uprawnień Graph API (GroupMember.Read.All zamiast Group.Read.All) | S3 — principle of least privilege |
| B7 | Centralne logowanie (Application Insights / Log Analytics) | Produkcyjny monitoring i alerting |
| B8 | Rozważenie Zustand/Jotai zamiast 5 Context providers | Uproszczenie zarządzania stanem przy dalszym rozwoju |
| B9 | Dockerfile + Azure Container Apps | Alternatywa deployment zamiast App Service |
| B10 | Pipeline CI/CD (GitHub Actions) | Automatyczny quality gate: typecheck → lint → test → build na PR |

---

## Harmonogram

```
Faza 1 — Bezpieczeństwo                    ████████████░░░░░░░░░░░░░░░░░░░
  1.1 Nagłówki HTTP security                ███
  1.2 Auth guard na API                     ████
  1.3 Rate limiting                         ███
  1.4 Włączenie TS/ESLint w buildzie        ████
  1.5 Env vars server-only                  ██
  1.6 OData sanitizer                       ███

Faza 2 — Stabilizacja                      ░░░░░░░░░░░░████████░░░░░░░░░░░
  2.1 Env validation (Zod)                  ███
  2.2 Pin versions                          █
  2.3 Depcheck & cleanup                    ██
  2.4 React Strict Mode                     █
  2.5 Naming & dead code                    █

Faza 3 — Testy                              ░░░░░░░░░░░░░░░░░░░████████░░░░
  3.1 Vitest setup                          ██
  3.2 Testy warstwy danych                  ████
  3.3 Testy API routes                      ███

Faza 4 — Refactoring                       ░░░░░░░░░░░░░░░░░░░░░░░░░██████
  4.1 Rozbicie komponentów                  █████
  4.2 Skonsolidowany logger                 ██
  4.3 Standard API errors                   ██
  4.4 Magic numbers → constants             █
```

**Zależności między fazami:**
- Faza 1 jest niezależna i musi być pierwsza
- Faza 2 może być realizowana częściowo równolegle z Fazą 1 (zadania 2.2–2.5)
- Faza 3 powinna być przed Fazą 4 (refactoring wymaga testów jako safety net)
- Zadanie 1.4 (włączenie TS/ESLint) realizować jako ostatnie w Fazie 1 (po naprawieniu błędów z 1.2, 1.5)

---

## Definition of Done

Każde zadanie uznaje się za zakończone gdy:

- [ ] Kod zaimplementowany i kompiluje się (`pnpm typecheck` pass)
- [ ] `pnpm lint` pass (od momentu włączenia linta w fazie 1.4)
- [ ] Testy pass (`pnpm test` — od fazy 3)
- [ ] `pnpm build` kończy się sukcesem
- [ ] Zmiany przetestowane manualnie w środowisku dev
- [ ] PR przejrzany (code review)
- [ ] Dokumentacja zaktualizowana (jeśli dotyczy env vars lub architektury)
