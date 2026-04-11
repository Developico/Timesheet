# Historia zmian

Wszystkie istotne zmiany w projekcie są dokumentowane w tym pliku.

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/),
projekt stosuje [Semantic Versioning](https://semver.org/lang/pl/).

## [1.0.0] — 2026-04-11

### Dodane

- Skrypty wdrożeniowe PowerShell: Install-Timesheet.ps1, Setup-EntraId.ps1, helpers/Common.ps1
- Katalog Power Platform: schemat Dataverse, Provision-FullEnvironment.ps1
- Rozwiązania Power Platform: TimeTrack_1_0_0_0.zip, TimeTrackCustomConnector_1_0_0_0.zip (unmanaged)
- Release notes: v1.0.0
- Skrypty root: start-timesheet.cmd, stop-timesheet.cmd
- Dashboard KPI z kartami: łączne godziny, aktywne projekty, konsultanci
- Wykres godzin tygodniowych (7-dniowy trend) i przychodów miesięcznych (6-miesięczny trend)
- Widok kalendarza tygodniowego z rejestracją czasu pracy
- Zarządzanie projektami: lista z filtrami, sortowanie, formularz tworzenia, panel szczegółów
- Kreator raportów: filtrowanie po zakresie dat, grupowanie, multi-select, eksport
- Warstwa danych z interfejsem `IDataSource` (Mock + Dataverse)
- Uwierzytelnianie Azure AD (NextAuth.js + MSAL)
- RBAC: role Consultant i Administrator z grup bezpieczeństwa Entra ID
- Impersonacja konsultantów (ConsultantDock) dla administratorów
- Middleware bezpieczeństwa: HSTS, CSP, X-Frame-Options, rate limiting
- Cache kliencki (TTL + stale-while-revalidate) z prefetchem i localStorage persistence
- Integracja Microsoft Graph API (awatary użytkowników, lista konsultantów)
- Klient Dataverse z retry logic (429/503), paginacją (`@odata.nextLink`)
- Walidacja zmiennych środowiskowych (Zod) z fail-hard w produkcji
- Strukturalne logowanie z redakcją PII
- Volatile store dla tokenów (in-memory, szyfrowane)
- Dynamiczna strategia CSS (data atrybuty + agregowane style)
- Testy jednostkowe (Vitest) i E2E (Playwright)
- CI/CD: GitHub Actions → Azure App Service (standalone build)
- Skrypty: seed demo data, cleanup, weryfikacja geometrii wykresów
- Dokumentacja publiczna: README (PL/EN), SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, LICENSE
