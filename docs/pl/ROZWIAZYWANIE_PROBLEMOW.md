# Rozwiązywanie problemów

## Spis treści

- [Uruchamianie lokalne](#uruchamianie-lokalne)
- [Uwierzytelnianie](#uwierzytelnianie)
- [Dataverse](#dataverse)
- [API](#api)
- [UI / Przeglądarka](#ui--przeglądarka)
- [Build / Deploy](#build--deploy)
- [Testy](#testy)

---

## Uruchamianie lokalne

### Port 3000 zajęty

```bash
# Windows
npx kill-port 3000
# lub
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS / Linux
lsof -ti:3000 | xargs kill -9
```

### `pnpm install` kończy się błędem

```bash
# Upewnij się, że masz corepack
corepack enable
corepack prepare pnpm@latest --activate

# Wyczyść cache
pnpm store prune
rm -rf node_modules
pnpm install
```

### Brak zmiennych środowiskowych

W development aplikacja działa z wartościami domyślnymi. Ostrzeżenia z walidacji Zod (lib/env.ts) są informacyjne. W produkcji brak wymaganych zmiennych powoduje crash.

**Rozwiązanie**: skopiuj `.env.example` do `.env.local` i uzupełnij wartości.

---

## Uwierzytelnianie

### Redirect loop po zalogowaniu

**Przyczyna**: Nieprawidłowy `NEXTAUTH_URL` lub brak callback URL w rejestracji aplikacji.

**Rozwiązanie**:
1. Sprawdź `NEXTAUTH_URL` — musi odpowiadać URL aplikacji
2. W Entra ID → App Registration → Authentication → dodaj redirect URI: `https://yourdomain/api/auth/callback/azure-ad`

### Rola nie jest przypisana ("Unauthorized")

**Przyczyna**: Użytkownik nie należy do grupy admin ani konsultantów, lub brakuje groups claim.

**Rozwiązanie**:
1. Sprawdź, czy `ADMIN_GROUP_ID` i `CONSULTANT_GROUP_ID` mają poprawne Object ID
2. Sprawdź, czy grupy są typu **Security** (nie Microsoft 365 / Distribution)
3. Upewnij się, że **groups claim** jest skonfigurowany w Token Configuration
4. Użytkownik musi wylogować się i zalogować ponownie po dodaniu do grupy

### `AZURE_AD_CLIENT_SECRET is required`

W development to ostrzeżenie — aplikacja działa z danymi mock. W produkcji utwórz secret w App Registration i dodaj do zmiennych.

### Access token wygasł

Tokeny przechowywane są w volatile store (in-memory). Restart serwera wymusza ponowną autentykację. Token jest automatycznie odświeżany przez MSAL.

---

## Dataverse

### `dataSource: "mock"` mimo ustawienia Dataverse

**Przyczyna**: `NEXT_PUBLIC_USE_MOCK=true` nadpisuje Dataverse.

**Rozwiązanie**: Ustaw `NEXT_PUBLIC_USE_MOCK=false` i `DATAVERSE_ENABLED=true`.

### 401 Unauthorized z Dataverse

**Przyczyna**: Nieprawidłowe lub wygasłe dane uwierzytelniające Dataverse.

**Rozwiązanie**:
1. Sprawdź `DATAVERSE_CLIENT_ID` i `DATAVERSE_CLIENT_SECRET`
2. Upewnij się, że aplikacja ma Security Role w Dataverse
3. Sprawdź, czy `DATAVERSE_URL` jest poprawny (z `https://`)
4. Sprawdź, czy tenant ID jest prawidłowy

### 429 Too Many Requests z Dataverse

**Przyczyna**: Przekroczenie limitu żądań Dataverse API.

**Rozwiązanie**: Wbudowany retry (exponential backoff) obsługuje 429 automatycznie. Jeśli problem utrzymuje się:
1. Sprawdź logi — ile żądań na minutę?
2. Użyj cache klienckich (domyślnie włączony)
3. Zmniejsz częstotliwość odświeżania

### Brak danych — puste odpowiedzi

1. Sprawdź `GET /api/health` — status i dataSource
2. Sprawdź, czy encje w Dataverse mają dane (`statecode eq 0`)
3. Sprawdź mapowanie pól — czy zmienne `DATAVERSE_FIELD_*` odpowiadają rzeczywistym nazwom

---

## API

### 400 Bad Request

**Przyczyna**: Parametry nie przeszły walidacji Zod.

**Rozwiązanie**: Sprawdź wymagane parametry w `body` lub `searchParams`:
- `timeentries`: wymaga `from` i `to` (format YYYY-MM-DD)
- `days-off`: wymaga `from` i `to`
- `project-team`: wymaga `projectId`

### 429 Too Many Requests (rate limiter)

**Przyczyna**: Wbudowany rate limiter (middleware) odrzucił żądanie.

**Rozwiązanie**: Odczekaj czas z nagłówka `Retry-After` (sekundy). W development rate limiter ma wyższe limity.

### 501 Not Implemented

**Przyczyna**: Data source nie wspiera danej operacji (np. Mock nie ma `getProjectTeam`).

**Rozwiązanie**: Przełącz na Dataverse albo użyj innego endpointu.

### CORS errors

**Przyczyna**: API jest server-side, nie wymaga CORS dla własnej domeny. Jeśli widzisz CORS error:

1. Sprawdź, czy nie wywołujesz API z innej domeny
2. Sprawdź CSP w middleware — `connect-src` musi zawierać Twoją domenę

---

## UI / Przeglądarka

### Kalendarz nie wyświetla wpisów

1. Otwórz DevTools → Network → sprawdź `timeentries` request
2. Sprawdź zakres dat w query parameters
3. Czy dane mock mają wpisy w wybranym tygodniu?
4. Sprawdź cache kliencki — może zwracać stale data

### Dashboard KPI = 0

1. Sprawdź, czy są wpisy czasu w bieżącym miesiącu
2. Sprawdź `consultantId` w kontekście (ViewingScope)
3. Otwórz DevTools → Console → szukaj błędów fetch

### Stale dane po zmianie

Cache kliencki używa TTL. Aby wymusić odświeżenie:
1. Zamknij i otwórz kartę (resetuje sessionStorage)
2. Wyczyść localStorage (`projects:v1`, `consultants:v1`)
3. Hard refresh: `Ctrl+Shift+R`

---

## Build / Deploy

### Build standalone fails

```bash
# Sprawdź zmienne dla builda
pnpm build 2>&1 | tee build.log

# Szukaj błędów typów
pnpm typecheck
```

### Azure App Service — Application Error

1. Sprawdź logi: Azure Portal → App Service → Log stream
2. Upewnij się, że `NODE_ENV=production` jest ustawiony
3. Sprawdź startup command: `node server.js`
4. Sprawdź, czy wszystkie wymagane zmienne środowiskowe są ustawione

### GitHub Actions deploy nie działa

1. Sprawdź sekrety w Settings → Secrets and variables → Actions
2. `AZURE_WEBAPP_PUBLISH_PROFILE` musi być aktualny
3. Sprawdź logi workflow w zakładce Actions

---

## Testy

### Vitest nie uruchamia się

```bash
# Sprawdź konfigurację
pnpm vitest --version
pnpm typecheck
```

### Playwright timeouty

```bash
# Zainstaluj przeglądarki
pnpx playwright install

# Uruchom z debug
pnpm test:e2e -- --debug

# Zwiększ timeout w playwright.config.ts
```

### Snapshot mismatch

```bash
# Aktualizuj snapshoty
pnpm vitest --update
```
