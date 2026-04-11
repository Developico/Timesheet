# Lokalne środowisko deweloperskie

Ten dokument opisuje szczegółową konfigurację lokalnego środowiska. Dla szybkiego startu zobacz: [docs/pl/LOKALNE_WDROZENIE.md](../../docs/pl/LOKALNE_WDROZENIE.md).

## Wymagania systemowe

| Narzędzie | Minimalna wersja | Sprawdzenie |
|-----------|-----------------|-------------|
| Node.js | 20.x LTS | `node --version` |
| pnpm | 10.x | `pnpm --version` |
| Git | 2.x | `git --version` |
| VS Code | Latest | — |

### Zalecane rozszerzenia VS Code

- ESLint (`dbaeumer.vscode-eslint`)
- Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`)
- Prettier (`esbenp.prettier-vscode`)
- TypeScript Error Translator (`mattpocock.ts-error-translator`)

## Krok po kroku

### 1. Klonowanie

```bash
git clone https://github.com/Developico/developico-timesheet.git
cd developico-timesheet
```

### 2. Instalacja pnpm

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### 3. Instalacja zależności

```bash
pnpm install
```

### 4. Konfiguracja środowiska

```bash
cp .env.example .env.local
```

Domyślny `.env.example` jest skonfigurowany do trybu mock — nie wymaga żadnych usług zewnętrznych.

### 5. Uruchomienie

```bash
# Standardowy dev server
pnpm dev

# Z Turbopack (szybszy)
pnpm dev-turbo
```

Otwórz http://localhost:3000.

## Struktura projektu

```
├── app/                    # Next.js App Router
│   ├── api/               # REST API routes
│   │   ├── dataverse/     # Dataverse endpoints
│   │   ├── graph/         # Microsoft Graph endpoints
│   │   ├── reports/       # Reports (admin only)
│   │   ├── health/        # Health check
│   │   └── me/            # Current user
│   ├── dashboard/         # Dashboard page
│   ├── calendar/          # Calendar page
│   ├── projects/          # Projects page
│   └── reports/           # Reports page
├── components/            # React components
│   ├── ui/                # shadcn/ui primitives
│   ├── dashboard/         # Dashboard-specific
│   ├── calendar/          # Calendar-specific
│   ├── projects/          # Projects-specific
│   ├── admin/             # Admin components
│   └── layout/            # Layout components
├── data/                  # Data layer
│   ├── interfaces.ts      # IDataSource interface
│   ├── mock.ts            # Mock implementation
│   ├── dataverse.ts       # Dataverse implementation
│   └── source.ts          # Factory
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities
│   ├── auth-client.tsx    # Client auth context
│   ├── dataverse-client.ts # Dataverse HTTP client
│   ├── dataverse-config.ts # Field mapping config
│   ├── env.ts             # Env validation (Zod)
│   ├── client-cache.ts    # Client-side cache
│   ├── rate-limiter.ts    # Rate limiting
│   └── app-logger.ts      # Structured logging
├── pages/                 # Pages Router (auth only)
│   └── api/auth/          # NextAuth.js
├── types/                 # TypeScript types
├── tests/                 # Vitest unit tests
├── e2e/                   # Playwright E2E tests
├── styles/                # Global CSS
└── public/                # Static assets
```

## Tryby pracy

### Mock (domyślny)

```env
NEXT_PUBLIC_USE_MOCK=true
```

- Brak zależności zewnętrznych
- Dane demo w `data/mock.ts`
- Pełna funkcjonalność UI

### Dataverse

```env
NEXT_PUBLIC_USE_MOCK=false
DATAVERSE_ENABLED=true
DATAVERSE_URL=https://yourorg.crm4.dynamics.com
DATAVERSE_CLIENT_ID=...
DATAVERSE_CLIENT_SECRET=...
```

Wymaga konfiguracji App Registration z uprawnieniami CRM.

### Pełny (Dataverse + Azure AD)

Wymaga kompletnej konfiguracji Entra ID — patrz [ENTRA_ID_KONFIGURACJA.md](../azure/ENTRA_ID_KONFIGURACJA.md).

## Komendy deweloperskie

| Komenda | Opis |
|---------|------|
| `pnpm dev` | Server deweloperski (port 3000) |
| `pnpm dev-turbo` | Server z Turbopack |
| `pnpm build` | Build produkcyjny (standalone) |
| `pnpm start` | Uruchom build produkcyjny |
| `pnpm typecheck` | Sprawdzenie typów TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Testy Vitest |
| `pnpm test:watch` | Vitest w trybie watch |
| `pnpm test:e2e` | Testy Playwright |
| `pnpm seed:demo` | Załaduj dane demo do Dataverse |
| `pnpm seed:demo:dry` | Podgląd danych demo |
| `pnpm seed:cleanup` | Usuń dane demo |

## Debugowanie

### VS Code Debugger

Uruchom skonfigurowany launch config (jeśli dostępny) lub:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Next.js Dev",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["dev"],
  "port": 9229
}
```

### Network Inspector

1. DevTools → Network → Filter: `/api/`
2. Sprawdź request / response / headers
3. Correlation ID (`cid`) w odpowiedziach pomaga powiązać z logami serwera

### Logi

Serwer loguje do konsoli. Ustawienia:

```env
LOG_MODE=console   # console | file | silent
```
