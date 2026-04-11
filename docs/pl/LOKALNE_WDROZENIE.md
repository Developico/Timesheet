# Lokalne wdrożenie

## Spis treści

- [Wymagania](#wymagania)
- [Instalacja](#instalacja)
- [Tryb mock (domyślny)](#tryb-mock-domyślny)
- [Podłączenie Dataverse](#podłączenie-dataverse)
- [Podłączenie Azure AD](#podłączenie-azure-ad)
- [Przydatne komendy](#przydatne-komendy)
- [Rozwiązywanie problemów](#rozwiązywanie-problemów)

## Wymagania

| Narzędzie | Wersja | Instalacja |
|-----------|--------|------------|
| Node.js | 20.x lub 22.x | [nodejs.org](https://nodejs.org/) |
| pnpm | 10+ | `corepack enable && corepack prepare pnpm@latest --activate` |
| Git | 2.x+ | [git-scm.com](https://git-scm.com/) |

## Instalacja

```bash
# Klonowanie repozytorium
git clone https://github.com/Developico/developico-timesheet.git
cd developico-timesheet

# Instalacja zależności
pnpm install

# Konfiguracja zmiennych środowiskowych
cp .env.example .env.local

# Uruchomienie serwera deweloperskiego
pnpm dev
```

Aplikacja dostępna na http://localhost:3000.

## Tryb mock (domyślny)

Domyślnie aplikacja działa z danymi mock (`NEXT_PUBLIC_USE_MOCK=true` w `.env.example`). Ten tryb:

- Nie wymaga żadnych usług zewnętrznych
- Dostarcza przykładowe dane (konsultanci, projekty, wpisy czasu)
- Pozwala na pełne testowanie UI i logiki
- Nie wymaga uwierzytelniania

### Dane demo

```bash
# Załadowanie danych demo (Dataverse)
pnpm seed:demo

# Podgląd bez zapisu
pnpm seed:demo:dry

# Usunięcie danych demo
pnpm seed:cleanup
```

## Podłączenie Dataverse

Aby podłączyć prawdziwy backend Dataverse:

### 1. Rejestracja aplikacji w Entra ID

1. Azure Portal → Entra ID → App registrations → New registration
2. Nazwa: `developico-timesheet-api`
3. Uprawnienia API: Dynamics CRM → `user_impersonation`
4. Wygeneruj client secret

### 2. Konfiguracja `.env.local`

```env
NEXT_PUBLIC_USE_MOCK=false
DATAVERSE_ENABLED=true
DATAVERSE_URL=https://yourorg.crm4.dynamics.com
DATAVERSE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DATAVERSE_CLIENT_SECRET=your-secret
```

### 3. Weryfikacja

Uruchom aplikację i sprawdź endpoint:

```
GET http://localhost:3000/api/health
```

Powinien zwrócić `"dataSource": "dataverse"`.

## Podłączenie Azure AD

Do pełnego uwierzytelniania:

### 1. Rejestracja aplikacji

1. Azure Portal → Entra ID → App registrations → New registration
2. Redirect URIs: `http://localhost:3000/api/auth/callback/azure-ad`
3. Uprawnienia Graph API: `User.Read`, `User.ReadBasic.All`, `GroupMember.Read.All`, `Group.Read.All`
4. Opcjonalnie: Custom scope `api://APP_ID/access_as_user`

### 2. Grupy bezpieczeństwa

Utwórz w Entra ID:
- Grupa **Administratorzy** → skopiuj Object ID
- Grupa **Konsultanci** → skopiuj Object ID

### 3. Token Configuration

W App Registration → Token configuration → Add groups claim:
- Zaznacz: Security groups
- Token type: ID

### 4. Konfiguracja `.env.local`

```env
AZURE_AD_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_AD_CLIENT_SECRET=your-secret
AZURE_AD_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXTAUTH_SECRET=random-string-at-least-32-chars
ADMIN_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CONSULTANT_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Przydatne komendy

```bash
# Serwer deweloperski
pnpm dev

# Serwer z Turbopack (szybszy hot reload)
pnpm dev-turbo

# Sprawdzenie typów
pnpm typecheck

# Linting
pnpm lint

# Testy jednostkowe
pnpm test

# Testy w trybie watch
pnpm test:watch

# Testy E2E (wymaga uruchomionego serwera)
pnpm test:e2e

# Build produkcyjny
pnpm build

# Uruchomienie builda
pnpm start
```

## Rozwiązywanie problemów

### Port 3000 zajęty

```bash
# Windows
npx kill-port 3000
# lub
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Błąd `AZURE_AD_CLIENT_ID is required`

W trybie development to ostrzeżenie jest non-fatal. Aplikacja działa z danymi mock. W produkcji ustaw wszystkie wymagane zmienne.

### `pnpm install` kończy się błędem

Upewnij się, że masz włączony corepack:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### Brak danych po przełączeniu na Dataverse

1. Sprawdź `GET /api/health` — czy `dataSource` to `dataverse`?
2. Sprawdź logi w konsoli — szukaj `[dataverse]`
3. Upewnij się, że `DATAVERSE_ENABLED=true` i URL jest poprawny
4. Sprawdź uprawnienia aplikacji w Dataverse (Security Role)

Pełna lista problemów: [ROZWIAZYWANIE_PROBLEMOW.md](ROZWIAZYWANIE_PROBLEMOW.md)
