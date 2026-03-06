# Developico Timesheet — Audyt Projektu

> **Data audytu:** 2026-03-06  
> **Wersja projektu:** 0.1.0  
> **Stack:** Next.js 14.2.16 · React 18 · TypeScript 5 · Tailwind CSS 4 · NextAuth 4 · Microsoft Dataverse  

---

## Spis treści

1. [Podsumowanie](#1-podsumowanie)
2. [Architektura](#2-architektura)
   - 2.1 [Struktura katalogów](#21-struktura-katalogów)
   - 2.2 [Przepływ danych](#22-przepływ-danych)
   - 2.3 [Warstwa API](#23-warstwa-api)
   - 2.4 [Zarządzanie stanem](#24-zarządzanie-stanem)
   - 2.5 [Warstwa danych (Dataverse / Mock)](#25-warstwa-danych)
   - 2.6 [System cachowania](#26-system-cachowania)
3. [Bezpieczeństwo](#3-bezpieczeństwo)
   - 3.1 [Mocne strony](#31-mocne-strony)
   - 3.2 [Podatności i ryzyka](#32-podatności-i-ryzyka)
4. [Jakość kodu i dobre praktyki](#4-jakość-kodu-i-dobre-praktyki)
   - 4.1 [Mocne strony](#41-mocne-strony)
   - 4.2 [Problemy i rekomendacje](#42-problemy-i-rekomendacje)
5. [Konfiguracja i deployment](#5-konfiguracja-i-deployment)
6. [Testy](#6-testy)
7. [Podsumowanie zaleceń](#7-podsumowanie-zaleceń)

---

## 1. Podsumowanie

Projekt **Developico Timesheet** (dvlp-tt) to aplikacja Next.js służąca do zarządzania rejestracją czasu pracy, integrująca się z Microsoft Dataverse i Microsoft Graph API. Posiada solidną podstawę architektoniczną z wyraźną separacją warstw, dobrze zaprojektowanym systemem autentykacji Azure AD oraz przemyślanym mechanizmem cache'owania po stronie klienta.

Główne obszary wymagające uwagi:

| Kategoria | Ocena | Komentarz |
|-----------|-------|-----------|
| Architektura | ⭐⭐⭐⭐ | Czytelna separacja warstw, interfejsy abstrakcji danych, modularny układ |
| Bezpieczeństwo | ⭐⭐⭐ | Solidna autentykacja, ale brak nagłówków bezpieczeństwa, wyłączony lint w buildzie |
| Jakość kodu | ⭐⭐⭐ | Strict TypeScript, ale brak testów, złożone komponenty, niespójna obsługa błędów |
| Testy | ⭐ | Brak zestawu testów (poza jednym skryptem geometrii) |
| DevOps / CI | ⭐⭐ | Env templates istnieją, brak pipeline'u CI/CD |

---

## 2. Architektura

### 2.1 Struktura katalogów

```
dvlp-tt/
├── app/                       # Next.js App Router (strony + API routes)
│   ├── api/
│   │   ├── dataverse/         # Endpointy REST do Dataverse
│   │   │   ├── consultants/
│   │   │   ├── days-off/
│   │   │   ├── project-assignments/
│   │   │   ├── project-team/
│   │   │   ├── projects/
│   │   │   └── timeentries/
│   │   ├── graph/             # Endpointy Microsoft Graph
│   │   │   ├── consultants/
│   │   │   └── users/
│   │   ├── health/            # Health check
│   │   └── me/                # Dane zalogowanego użytkownika
│   ├── calendar/
│   ├── dashboard/
│   └── projects/
├── components/                # Komponenty React
│   ├── admin/                 # Panel administracyjny (ConsultantDock, ViewingBanner)
│   ├── auth/                  # Ekran logowania
│   ├── calendar/              # Widok kalendarza
│   ├── dashboard/             # KPI, wykresy
│   ├── layout/                # Navbar, FilterBar, NavigationTabs
│   ├── projects/              # Tabela projektów, panel szczegółów
│   └── ui/                    # Prymitywy shadcn/ui
├── data/                      # Warstwa dostępu do danych
│   ├── dataverse.ts           # Implementacja DataverseDataSource
│   ├── interfaces.ts          # Interfejs IDataSource
│   ├── mock.ts                # MockDataSource (dane testowe)
│   └── source.ts              # Factory pattern (wybór źródła)
├── hooks/                     # Custom React hooks (cache, UI)
├── lib/                       # Narzędzia i logika biznesowa
│   ├── auth-client.tsx        # AuthProvider, useAuth
│   ├── dataverse-auth.ts      # Tokeny MSAL (client credentials)
│   ├── dataverse-client.ts    # HTTP client do Dataverse (retry, pagination)
│   ├── dataverse-config.ts    # Mapowanie pól Dataverse z env vars
│   ├── dataverse-user-map.ts  # Mapowanie AAD OID → Dataverse ID
│   ├── filter-context.tsx     # Globalny stan filtrów
│   ├── viewing-scope.tsx      # Kontekst przełączania konsultantów (admin)
│   ├── client-cache.ts        # Cache po stronie klienta (TTL + stale)
│   ├── volatile-store.ts      # Transient storage tokenów (server)
│   ├── app-logger.ts          # Structured logging z redakcją
│   ├── server-log.ts          # Logger server-side
│   ├── metrics.ts             # Obliczenia KPI
│   └── ...
├── pages/api/auth/            # NextAuth handler (Pages Router)
├── types/                     # Interfejsy TypeScript
└── scripts/                   # Skrypty narzędziowe
```

**Ocena:** Struktura jest logiczna i czytelna. Separacja `data/` (DAL), `lib/` (logika) i `components/` (UI) ułatwia nawigację. Mieszanie App Router (`app/api/`) z Pages Router (`pages/api/auth/`) jest konieczne ze względu na ograniczenia NextAuth 4, ale warto zaplanować migrację przy upgrade do NextAuth 5.

### 2.2 Przepływ danych

```
┌─────────────┐     Fetch     ┌─────────────┐     OData     ┌───────────────┐
│  React Hooks │ ──────────▶ │ API Routes   │ ──────────▶  │  Dataverse    │
│  (client)    │ ◀────────── │ (server)     │ ◀────────── │  (cloud)      │
└─────────────┘    JSON       └─────────────┘    JSON       └───────────────┘
       │                            │
       │ useMemo                    │ MSAL
       ▼                            ▼
┌─────────────┐              ┌───────────────┐    Graph     ┌───────────────┐
│ Components   │              │ Token Mgmt    │ ──────────▶ │ Microsoft     │
│ (UI render)  │              │ (volatile)    │             │ Graph API     │
└─────────────┘              └───────────────┘             └───────────────┘
```

Przepływ jest jednokierunkowy i przejrzysty:
1. Hooki klienckie (`useProjects`, `useTimeEntries`, ...) fetchują dane z API routes
2. API routes autentykują request (NextAuth JWT) i mapują użytkownika na konsultanta Dataverse
3. Dane pobierane z Dataverse lub Graph API są zwracane jako JSON
4. Komponenty renderują dane z memoizacją

### 2.3 Warstwa API

| Endpoint | Metoda | Opis | Uwierzytelnienie |
|----------|--------|------|-------------------|
| `/api/dataverse/timeentries` | GET | Wpisy czasu (Zod validation) | JWT + AAD OID mapping |
| `/api/dataverse/projects` | GET | Lista projektów | JWT |
| `/api/dataverse/consultants` | GET | Lista konsultantów | Brak (uwaga!) |
| `/api/dataverse/days-off` | GET | Dni wolne | Brak (uwaga!) |
| `/api/dataverse/project-assignments` | GET | Przypisania projektów | JWT + AAD mapping |
| `/api/dataverse/project-team` | GET | Zespół projektu | JWT |
| `/api/graph/consultants` | GET | Członkowie grupy AD | Session required |
| `/api/me` | GET | Dane bieżącego użytkownika | JWT |
| `/api/me/photo` | GET | Zdjęcie profilowe z Graph | OBO token |
| `/api/health` | GET | Health check | Brak |

**Problem:** Nie wszystkie endpointy Dataverse weryfikują autentykację w jednolity sposób. Endpointy `/consultants` i `/days-off` mogą nie sprawdzać sesji.

### 2.4 Zarządzanie stanem

Aplikacja używa **5 zagnieżdżonych kontekstów React**:

```tsx
<SessionProvider>           {/* NextAuth session */}
  <AuthProvider>            {/* Custom auth: user, role, permissions */}
    <ViewingScopeProvider>  {/* Admin: podgląd danych innego konsultanta */}
      <ThemeProvider>       {/* Motyw + tryb wysokiego kontrastu */}
        {children}
      </ThemeProvider>
    </ViewingScopeProvider>
  </AuthProvider>
</SessionProvider>
```

Dodatkowy stan globalny:
- `FilterContext` — globalne filtry (data, projekty, konsultanci, typ wpisu)
- `client-cache.ts` — cache w pamięci przeglądarki z TTL

**Ryzyko:** Przy dalszym rozwoju wiele kontekstów może prowadzić do "context sprawl". Warto rozważyć bibliotekę stanów (np. Zustand) jeśli liczba kontekstów będzie rosnąć.

### 2.5 Warstwa danych

Wykorzystano wzorzec **Strategy Pattern** z interfejsem `IDataSource`:

```typescript
// data/interfaces.ts
export interface IDataSource {
  getConsultants(): Promise<Consultant[]>
  getProjects(currentConsultantId?: string): Promise<Project[]>
  getTimeEntries(params: TimeEntryFilters): Promise<TimeEntry[]>
  getProjectAssignments?(consultantId: string): Promise<string[]>
  getProjectTeam?(projectId: string): Promise<string[]>
  getDaysOff?(from: string, to: string): Promise<DayOff[]>
}

// data/source.ts — Factory
export const dataSource: IDataSource = isDataverseEnabled()
  ? new DataverseDataSource()
  : new MockDataSource()
```

**Mocne strony:**
- Czysta abstrakcja umożliwia łatwą podmianę implementacji
- Mock data source dla developmentu bez Dataverse
- Feature flag `DATAVERSE_ENABLED` steruje źródłem

**Problemy:**
- `DataverseDataSource` to ~500+ linii z wieloma fallbackami — wymaga rozbicia na mniejsze moduły
- Logika retry i obsługa błędnych nazw pól (fallback columns) jest zbyt złożona i trudna do debugowania
- Brak walidacji schematu odpowiedzi z Dataverse (dane mogą mieć nieoczekiwaną strukturę)

### 2.6 System cachowania

Dwupoziomowy system cache:

| Warstwa | Narzędzie | TTL | Zakres |
|---------|-----------|-----|--------|
| **Klient** | `lib/client-cache.ts` | 15 min fresh / 2h stale | Per-key w pamięci + localStorage |
| **Serwer** | `lib/volatile-store.ts` | Per-token TTL | Tokeny OBO (file persistence opcjonalna) |
| **Serwer** | `lib/dataverse-user-map.ts` | 5 min | Mapowanie AAD → Dataverse ID |
| **Serwer** | `lib/graph-app-token.ts` | Do wygaśnięcia -60s | Graph application token |

**Strategia klienta:** Stale-While-Revalidate — natychmiast zwraca dane ze stanu `stale`, a w tle pobiera świeże dane. Zapobiega duplikowaniu requestów (in-flight tracking).

**Potencjalne problemy:**
- `volatile-store.ts` zapisuje tokeny do pliku `.next/volatile-store.json` (opcjonalnie) — w środowisku wieloinstancyjnym (scaling) może to powodować niespójności
- Brak centralnego cache invalidation po stronie serwera

---

## 3. Bezpieczeństwo

### 3.1 Mocne strony

#### Autentykacja i autoryzacja
- ✅ **NextAuth.js z Azure AD** — solidna, przetestowana biblioteka
- ✅ **JWT z tokenami pośrednimi** — tokeny AAD przechowywane w `volatile-store` z indirection (klucz = random pointer, nie surowy token)
- ✅ **RBAC** — role `Administrator` / `Consultant` / `Unauthorized` z group claims z id_token
- ✅ **OBO (On-Behalf-Of)** flow do delegowanych operacji Graph API
- ✅ **Walidacja NEXTAUTH_SECRET** — ostrzeżenie w logach gdy brakuje

#### Obsługa tokenów
- ✅ Tokeny nie trafiają do `localStorage` (w przeciwieństwie do wielu aplikacji SPA)
- ✅ Automatyczne czyszczenie wygasłych tokenów (60s interval)
- ✅ Osobne credential sets dla web app (NextAuth) i Dataverse (S2S)
- ✅ Refresh token przechowywany z 30-dniowym TTL

#### Walidacja danych
- ✅ **Zod** do walidacji parametrów query (`timeentries/route.ts`)
- ✅ Regex walidacja GUID przed zapytaniami Dataverse
- ✅ TypeScript strict mode

#### Logowanie
- ✅ Structured JSON logging
- ✅ **Automatyczna redakcja** pól: `token`, `secret`, `password`, `access_token`, `refresh_token`
- ✅ Correlation IDs do śledzenia requestów
- ✅ Sanityzacja błędów (`sanitizeError`) — ogranicza stack trace do 6 linii

### 3.2 Podatności i ryzyka

#### 🔴 KRYTYCZNE

**K1. Wyłączenie walidacji TypeScript i ESLint w buildzie**
```javascript
// next.config.mjs
eslint: { ignoreDuringBuilds: true },
typescript: { ignoreBuildErrors: true },
```
- **Ryzyko:** Błędy typów i potencjalne podatności wykrywalne przez lint nie blokują buildu produkcyjnego
- **Rekomendacja:** Usunąć te flagi. Przenieść quality gates do pipeline CI (`npm run typecheck && npm run lint` przed `next build`)

**K2. Brak nagłówków bezpieczeństwa HTTP**
- Brak konfiguracji: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`
- Brak middleware Next.js definiującego nagłówki (plik `middleware.ts` nie istnieje w katalogu głównym)
- **Ryzyko:** Clickjacking, MIME type sniffing, brak HSTS
- **Rekomendacja:** Dodać middleware z nagłówkami lub konfigurację `headers()` w `next.config.mjs`

**K3. Brak rate-limitingu na API routes**
- Żaden endpoint nie implementuje ograniczenia liczby requestów
- **Ryzyko:** Brute force, DoS, nadmierne obciążenie Dataverse
- **Rekomendacja:** Middleware z rate-limiterem (np. `next-rate-limit` lub custom z `Map<IP, count>`)

#### 🟡 WYSOKIE

**W1. Niekonsekwentna weryfikacja autentykacji na endpointach**
- Endpointy `/api/dataverse/consultants` i `/api/dataverse/days-off` mogą nie sprawdzać sesji/JWT
- **Ryzyko:** Nieuwierzytelniony dostęp do listy konsultantów
- **Rekomendacja:** Zunifikować middleware/guard dla wszystkich tras `/api/dataverse/*`

**W2. Potencjalne ryzyko OData Injection**
- Parametry budujące filtry OData (np. `consultantId`, `projectIds`) są wstawiane do query stringa
- Walidacja GUID (regex) pokrywa główny wektor, ale brak ogólnego sanitizera OData
- **Rekomendacja:** Zapewnić, że KAŻDY parametr wchodzący do filtra OData jest ściśle walidowany (whitelist format)

**W3. Group IDs w zmiennych NEXT_PUBLIC_***
```
NEXT_PUBLIC_ADMIN_GROUP=<guid>
NEXT_PUBLIC_CONSULTANT_GROUP=<guid>
```
- Prefiks `NEXT_PUBLIC_` oznacza, że te wartości trafiają do bundla klienta
- **Ryzyko:** Ujawnienie identyfikatorów grup AD w kodzie JavaScript wysyłanym do przeglądarki
- **Rekomendacja:** Przenieść do zmiennych server-only (bez prefiksu `NEXT_PUBLIC_`)

**W4. React Strict Mode wyłączony**
```javascript
reactStrictMode: false,
```
- Strict Mode wykrywa efekty uboczne, deprecated API, niebezpieczne lifecycle
- **Rekomendacja:** Włączyć w developmencie, opcjonalnie wyłączyć w produkcji jeśli powoduje problemy

#### 🟢 ŚREDNIE

**S1. Volatile store z opcjonalnym zapisem na dysk**
- `VOLATILE_STORE_PERSIST=true` zapisuje tokeny do `.next/volatile-store.json`
- **Ryzyko:** Tokeny przechowywane w pliku na dysku (nie verschlüsselt)
- **Rekomendacja:** Domyślnie wyłączyć persystencję w produkcji lub szyfrować plik

**S2. Brak CORS configuration**
- Brak jawnej konfiguracji CORS na API routes
- W Next.js domyślnie same-origin, ale brak jawnej blokady
- **Rekomendacja:** Dodać nagłówek `Access-Control-Allow-Origin` z whitelistą domen

**S3. Uprawnienia Graph API**
- Scope `Group.Read.All` to wysoki poziom uprawnień (widoczność wszystkich grup w tenancie)
- Fallback `transitiveMembers` może eksponować strukturę zagnieżdżonych grup
- **Rekomendacja:** Rozważyć `GroupMember.Read.All` + ograniczenie do konkretnych grup (app consent)

**S4. Dane z Dataverse/Graph renderowane bez sanityzacji**
- Nazwy projektów, notatki, imiona z Dataverse wchodzą do JSX bez explicit escape
- React domyślnie escapuje w `{}`, ale ryzyko przy `dangerouslySetInnerHTML` (nie znaleziony, ale brak gwarancji)
- **Rekomendacja:** Upewnić się, że żadne pole z zewnętrznego źródła nie jest renderowane jako raw HTML

**S5. Brak rotacji sekretów**
- `DATAVERSE_CLIENT_SECRET`, `AZURE_AD_CLIENT_SECRET`, `NEXTAUTH_SECRET` bez mechanizmu rotacji
- **Rekomendacja:** Integracja z Azure Key Vault lub przynajmniej procedura rotacji

---

## 4. Jakość kodu i dobre praktyki

### 4.1 Mocne strony

- ✅ **TypeScript strict mode** — pełna kontrola typów, brak implicit `any`
- ✅ **Zdefiniowane interfejsy** — `IDataSource`, `Consultant`, `Project`, `TimeEntry`, `KPIMetrics` etc.
- ✅ **Wzorce projektowe:**
  - Strategy Pattern (data source switching)
  - Provider Pattern (React contexts)
  - Factory Pattern (`getDataSource()`)
  - Stale-While-Revalidate (client cache)
- ✅ **Oddzielenie warstw** — UI → Business Logic → Data Access → External API
- ✅ **Modularność hooks** — każdy hook odpowiada za jedno zagadnienie
- ✅ **Responsywność UI** — mobilne widoki, swipe gestures, adaptive layout
- ✅ **Accessibility** — high contrast mode, keyboard shortcuts, ARIA attributes
- ✅ **Walidacja wejścia** — Zod schemas na krytycznych endpointach
- ✅ **Kolorystyczny design system** — CSS custom properties, semantic tokens, oklch color scale

### 4.2 Problemy i rekomendacje

#### Złożoność komponentów

| Komponent | Problem | Rekomendacja |
|-----------|---------|--------------|
| `calendar-view.tsx` | 500+ linii, mieszanie logiki filtrowania, gestów i renderowania | Wyodrębnić: `useCalendarNavigation`, `useCalendarData`, `CalendarGrid`, `CalendarDayCell` |
| `projects-table.tsx` | Sortowanie + filtrowanie + scope + columns visibility w jednym pliku | Wydzielić `useProjectsSorting`, `useProjectsFiltering`, `ColumnVisibilityToggle` |
| `kpi-cards.tsx` | Animacja count-up + logika KPI + warunkowe style | Wydzielić `useCountUpAnimation`, osobne karty jako sub-komponenty |
| `data/dataverse.ts` | 500+ linii z wieloma retry/fallback paths | Rozbić na: `DataverseConsultants`, `DataverseProjects`, `DataverseTimeEntries` |

#### Niespójności

| Problem | Lokalizacja | Rekomendacja |
|---------|-------------|--------------|
| Niespójne formaty błędów API | Różne route handlers | Opracować standardowy format: `{ error: string, code?: string, details?: unknown }` |
| Magic numbers | Cache TTL `15*60_000`, stale `2*60*60_000` | Wyodrębnić stałe: `CACHE_TTL_MS`, `CACHE_STALE_MS` |
| Wielokrotne definicje loggerów | `app-logger.ts`, `server-log.ts`, `[...nextauth].ts` | Skonsolidować do jednego modułu logowania |
| `latest` w wersji zależności | `@radix-ui/react-checkbox: "latest"`, `next-themes: "latest"` | Przypiąć konkretne wersje (lock nieprzewidywalnych upgradów) |
| Pusty skrypt deployment | `scripts/apply-env-to-appservice.ps1` (0 bytes) | Usunąć lub zaimplementować |

#### Nazewnictwo

| Problem | Rekomendacja |
|---------|--------------|
| `my-v0-project` jako nazwa w package.json | Zmienić na `developico-timesheet` lub `dvlp-tt` |
| Inconsistent `useUltraStablePanelState` vs `useStablePanelState` | Zunifikować nazewnictwo i usunąć duplikację |
| `disable-fast-refresh.js` — funkcja redundantna w Next.js 14 | Rozważyć usunięcie (Fast Refresh konfigurowany w next.config) |

#### Zarządzanie zależnościami

| Problem | Szczegóły |
|---------|-----------|
| 20+ pakietów Radix UI | Wiele może być unused — audyt z `depcheck` |
| `@vercel/analytics` | Obecny w dependencies, ale brak jawnego użycia (import usunięty z layout) |
| `autoprefixer` | Może być zbędny z Tailwind CSS 4 (built-in prefixer) |
| `tailwindcss-animate` + `tw-animate-css` | Potencjalna duplikacja funkcjonalności animacji |
| Rozbieżność eslint-config-next (15.5.3) vs next (14.2.16) | Major version mismatch |

---

## 5. Konfiguracja i deployment

### Environment variables

Projekt wymaga ~20+ zmiennych środowiskowych. Istnieje `.env.example` i `.env.production.template`.

**Obserwacje:**
- ✅ Dobre rozdzielenie na Web App credentials (delegated) i Dataverse credentials (application)
- ✅ Template produkcyjny jest dobrze udokumentowany
- ⚠️ Brak walidacji zmiennych na starcie aplikacji (np. sprawdzenie czy `NEXTAUTH_SECRET` jest ustawiony przed uruchomieniem)
- ⚠️ 40+ zmiennych `DATAVERSE_FIELD_*` / `DATAVERSE_ENTITY_*` bez centralnej walidacji
- ⚠️ `.env.example` jest minimalny — nie pokrywa pełnej konfiguracji Dataverse

**Rekomendacja:** Dodać plik `lib/env-validation.ts` z Zod schema walidującym wymagane env vars na starcie:
```typescript
const envSchema = z.object({
  NEXTAUTH_SECRET: z.string().min(32),
  AZURE_AD_CLIENT_ID: z.string().uuid(),
  // ...
})
```

### Deployment na Azure App Service

- Port: 3000 (domyślny Next.js)
- Brak `startup.sh` — wymagana konfiguracja startup command
- Brak pliku `Dockerfile`
- Plik `scripts/apply-env-to-appservice.ps1` jest pusty

**Rekomendacja:** Uzupełnić dokumentację deployment lub dodać skrypt automatyzujący konfigurację App Service.

---

## 6. Testy

### Stan obecny

| Element | Status |
|---------|--------|
| Framework testowy | ❌ Brak (vitest/jest nie skonfigurowany) |
| Testy jednostkowe | ❌ Brak |
| Testy integracyjne API | ❌ Brak |
| Testy komponentów | ❌ Brak |
| Testy E2E | ❌ Brak |
| Skrypty testowe | ⚠️ Tylko `test:geom` (weryfikacja geometrii wykresów) |
| CI/CD pipeline | ❌ Brak (GitHub Actions / Azure DevOps) |
| Pokrycie kodu | ❌ Brak konfiguracji |

### Rekomendowane priorytety testów

1. **Warstwa danych** (krytyczne):
   - `data/dataverse.ts` — mockowane odpowiedzi HTTP, walidacja mapowania pól
   - `lib/dataverse-user-map.ts` — mapowanie AAD OID, cache behavior
   - `lib/metrics.ts` — obliczenia KPI (czysta logika, łatwa do testowania)

2. **API routes** (wysokie):
   - Walidacja parametrów Zod
   - Scenariusze 401/403/500
   - Poprawność mapowania AAD → Dataverse

3. **Hooks** (średnie):
   - `lib/client-cache.ts` — TTL, stale, invalidation, deduplication
   - `hooks/use-time-entries.ts` — poprawne budowanie cache keys

4. **Komponenty** (niższe):
   - `kpi-cards.tsx` — poprawne renderowanie przy różnych danych
   - `calendar-view.tsx` — nawigacja między miesiącami

---

## 7. Podsumowanie zaleceń

### Priorytet KRYTYCZNY 🔴

| # | Zalecenie | Obszar |
|---|-----------|--------|
| 1 | Włączyć walidację TypeScript/ESLint w buildzie (usunąć `ignoreBuildErrors` i `ignoreDuringBuilds`) | Bezpieczeństwo / Jakość |
| 2 | Dodać nagłówki bezpieczeństwa HTTP (CSP, HSTS, X-Frame-Options itp.) — via middleware lub next.config headers | Bezpieczeństwo |
| 3 | Dodać rate-limiting na endpointach API | Bezpieczeństwo |
| 4 | Zunifikować weryfikację autentykacji na WSZYSTKICH endpointach `/api/dataverse/*` | Bezpieczeństwo |

### Priorytet WYSOKI 🟡

| # | Zalecenie | Obszar |
|---|-----------|--------|
| 5 | Przenieść `NEXT_PUBLIC_ADMIN_GROUP` / `NEXT_PUBLIC_CONSULTANT_GROUP` do zmiennych server-only | Bezpieczeństwo |
| 6 | Dodać walidację env vars na starcie aplikacji (Zod schema) | Niezawodność |
| 7 | Wdrożyć testy jednostkowe — minimalne pokrycie warstwy danych + metryki + API routes | Jakość |
| 8 | Skonfigurować CI/CD pipeline (`typecheck → lint → test → build`) | DevOps |
| 9 | Włączyć React Strict Mode (przynajmniej w developmencie) | Jakość |
| 10 | Przypiąć wersje zależności marked jako `latest` | Stabilność |

### Priorytet ŚREDNI 🟢

| # | Zalecenie | Obszar |
|---|-----------|--------|
| 11 | Rozbić duże komponenty (calendar-view, projects-table, dataverse.ts) na mniejsze moduły | Architektura |
| 12 | Skonsolidować loggery (app-logger + server-log + nextauth logger) | Jakość |
| 13 | Ustandaryzować format odpowiedzi błędów API | Architektura |
| 14 | Audyt nieużywanych zależności (`depcheck`) | Utrzymanie |
| 15 | Zmienić nazwę projektu z `my-v0-project` na docelową | Utrzymanie |
| 16 | Uzupełnić dokumentację deployment (Dockerfile lub startup script) | DevOps |
| 17 | Rozważyć integrację z Azure Key Vault dla rotacji sekretów | Bezpieczeństwo |
| 18 | Obsłużyć konfigurację CORS jawnie | Bezpieczeństwo |

---

> **Uwaga:** Raport został przygotowany na podstawie statycznej analizy kodu. Nie przeprowadzono testów penetracyjnych ani dynamicznej analizy bezpieczeństwa. W celu pełnego audytu bezpieczeństwa zaleca się dodatkowe narzędzia (SAST/DAST) oraz przegląd konfiguracji Azure AD.
