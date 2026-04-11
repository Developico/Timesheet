# Dokumentacja / Documentation

Indeks dokumentacji projektu Developico Timesheet.

---

## 🇵🇱 Dokumentacja (PL)

| Dokument | Opis |
|----------|------|
| [ARCHITEKTURA.md](pl/ARCHITEKTURA.md) | Architektura systemu, stos technologiczny, diagram |
| [API.md](pl/API.md) | Dokumentacja REST API — endpointy, parametry, odpowiedzi |
| [ZMIENNE_SRODOWISKOWE.md](pl/ZMIENNE_SRODOWISKOWE.md) | Wszystkie zmienne środowiskowe z opisami |
| [LOKALNE_WDROZENIE.md](pl/LOKALNE_WDROZENIE.md) | Konfiguracja lokalnego środowiska deweloperskiego |
| [ROLE.md](pl/ROLE.md) | Role, uprawnienia, impersonacja, konfiguracja grup Entra ID |
| [DATAVERSE_SCHEMAT.md](pl/DATAVERSE_SCHEMAT.md) | Schemat encji Dataverse, pola, zapytania OData |
| [ROZWIAZYWANIE_PROBLEMOW.md](pl/ROZWIAZYWANIE_PROBLEMOW.md) | Rozwiązywanie typowych problemów |

## 🇬🇧 Documentation (EN)

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](en/ARCHITECTURE.md) | System architecture, tech stack, diagram |
| [API.md](en/API.md) | REST API documentation — endpoints, parameters, responses |
| [ENVIRONMENT_VARIABLES.md](en/ENVIRONMENT_VARIABLES.md) | All environment variables with descriptions |
| [LOCAL_DEVELOPMENT.md](en/LOCAL_DEVELOPMENT.md) | Local development setup |
| [ROLES.md](en/ROLES.md) | Roles, permissions, impersonation, Entra ID group config |
| [DATAVERSE_SCHEMA.md](en/DATAVERSE_SCHEMA.md) | Dataverse entity schema, fields, OData queries |
| [TROUBLESHOOTING.md](en/TROUBLESHOOTING.md) | Common issues and solutions |

## 🚀 Wdrożenie / Deployment

| Dokument | Opis |
|----------|------|
| [deployment/README.md](../deployment/README.md) | Przegląd dokumentacji wdrożeniowej |
| [deployment/CHECKLIST.md](../deployment/CHECKLIST.md) | Lista kontrolna wdrożenia |
| [deployment/azure/APP_SERVICE_DEPLOYMENT.md](../deployment/azure/APP_SERVICE_DEPLOYMENT.md) | Wdrożenie na Azure App Service |
| [deployment/azure/AZURE_RESOURCES_SETUP.md](../deployment/azure/AZURE_RESOURCES_SETUP.md) | Konfiguracja zasobów Azure |
| [deployment/azure/ENTRA_ID_KONFIGURACJA.md](../deployment/azure/ENTRA_ID_KONFIGURACJA.md) | Konfiguracja Microsoft Entra ID |
| [deployment/local/LOCAL_DEVELOPMENT.md](../deployment/local/LOCAL_DEVELOPMENT.md) | Lokalne środowisko deweloperskie |

## 🔧 Skrypty wdrożeniowe / Deployment Scripts

| Plik | Opis |
|------|------|
| [deployment/azure/Install-Timesheet.ps1](../deployment/azure/Install-Timesheet.ps1) | Master installer — Azure App Service |
| [deployment/azure/Setup-EntraId.ps1](../deployment/azure/Setup-EntraId.ps1) | Konfiguracja App Registration (Entra ID) |
| [deployment/azure/helpers/Common.ps1](../deployment/azure/helpers/Common.ps1) | Współdzielone funkcje pomocnicze PowerShell |
| [start-timesheet.cmd](../start-timesheet.cmd) | Uruchomienie serwera deweloperskiego |
| [stop-timesheet.cmd](../stop-timesheet.cmd) | Zatrzymanie serwera deweloperskiego |

## ⚡ Power Platform

| Plik | Opis |
|------|------|
| [deployment/powerplatform/README.md](../deployment/powerplatform/README.md) | Schemat Dataverse, rozwiązania, aplikacje |
| [deployment/powerplatform/Provision-FullEnvironment.ps1](../deployment/powerplatform/Provision-FullEnvironment.ps1) | Provisioning schematu Dataverse |

## 📝 Release Notes

| Wersja | Plik |
|--------|------|
| v1.0.0 | [release-notes/v1.0.0.md](../release-notes/v1.0.0.md) |

## 📋 Projekt / Project

| Dokument | Opis |
|----------|------|
| [README.md](../README.md) | Główny opis projektu (PL) |
| [README.en.md](../README.en.md) | Main project description (EN) |
| [CHANGELOG.md](../CHANGELOG.md) | Historia zmian |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Zasady współtworzenia |
| [SECURITY.md](../SECURITY.md) | Polityka bezpieczeństwa |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Kodeks postępowania |
| [LICENSE](../LICENSE) | Licencja MIT |
