# Lista kontrolna wdrożenia

Użyj tej listy przed każdym wdrożeniem na środowisko produkcyjne.

## Pre-deploy

- [ ] **Build przechodzi bez błędów**: `pnpm build`
- [ ] **Typecheck**: `pnpm typecheck` — brak błędów
- [ ] **Testy jednostkowe**: `pnpm test` — wszystkie przechodzą
- [ ] **Testy E2E**: `pnpm test:e2e` — kluczowe scenariusze OK
- [ ] **Lint**: `pnpm lint` — brak krytycznych ostrzeżeń

## Zmienne środowiskowe

- [ ] `AZURE_AD_CLIENT_ID` — ustawiony
- [ ] `AZURE_AD_CLIENT_SECRET` — ustawiony, nie wygasły
- [ ] `AZURE_AD_TENANT_ID` — ustawiony
- [ ] `NEXTAUTH_SECRET` — ustawiony (min. 32 znaków, losowy)
- [ ] `NEXTAUTH_URL` — poprawny URL produkcyjny
- [ ] `ADMIN_GROUP_ID` — poprawny Object ID grupy
- [ ] `CONSULTANT_GROUP_ID` — poprawny Object ID grupy
- [ ] `NODE_ENV` = `production`

### Jeśli Dataverse

- [ ] `DATAVERSE_ENABLED` = `true`
- [ ] `DATAVERSE_URL` — poprawny URL instancji
- [ ] `DATAVERSE_CLIENT_ID` — ustawiony
- [ ] `DATAVERSE_CLIENT_SECRET` — ustawiony, nie wygasły
- [ ] `NEXT_PUBLIC_USE_MOCK` = `false`
- [ ] Aplikacja ma Security Role w Dataverse

## Azure App Service

- [ ] Plan: Linux (Node 20 LTS)
- [ ] Startup command: `node server.js`
- [ ] Always On: włączony
- [ ] HTTPS Only: włączony
- [ ] Minimum TLS version: 1.2
- [ ] Custom domain i certyfikat SSL (jeśli potrzebny)

## Entra ID

- [ ] Redirect URI wskazuje na produkcyjny URL: `https://domain/api/auth/callback/azure-ad`
- [ ] Groups claim skonfigurowany (Token Configuration → ID token)
- [ ] Grupy bezpieczeństwa istnieją i mają poprawnych członków
- [ ] Uprawnienia Graph API: `User.Read`, `User.ReadBasic.All`, `GroupMember.Read.All`
- [ ] Admin consent udzielony dla uprawnień Graph

## CI/CD (GitHub Actions)

- [ ] Secret `AZURE_WEBAPP_PUBLISH_PROFILE` — aktualny
- [ ] Workflow `.github/workflows/deploy.yml` — poprawny
- [ ] Branch protection na `main` (opcjonalnie)

## Post-deploy

- [ ] Sprawdź `GET /api/health` — status `ok`
- [ ] Sprawdź logowanie przez Azure AD
- [ ] Sprawdź czy rola jest poprawnie przypisana (Admin / Consultant)
- [ ] Sprawdź podstawowe operacje (podgląd projektów, wpisów czasu)
- [ ] Monitor Log stream — brak krytycznych błędów
- [ ] Sprawdź Application Insights (jeśli skonfigurowany)
