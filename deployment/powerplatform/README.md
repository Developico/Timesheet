# Power Platform — Developico Timesheet

## Przegląd / Overview

Katalog zawiera rozwiązania Power Platform związane z systemem Timesheet:
- **Dataverse Solutions** — schemat tabel, kolumn, relacji
- **Canvas App** — mobilna rejestracja czasu pracy
- **Model-Driven App** — panel administracyjny dla managerów

---

## Schemat Dataverse / Dataverse Schema

### Tabele / Tables

| Tabela (LogicalName)    | Opis                          | Typ            |
|------------------------|-------------------------------|----------------|
| `tt_project`           | Projekty                      | Custom         |
| `tt_projectuser`       | Przypisania user ↔ projekt    | Custom (N:N)   |
| `tt_timeregister`      | Wpisy czasu pracy             | Custom         |
| `tt_daysoff`           | Dni wolne / urlopy            | Custom         |
| `systemuser`           | Użytkownicy (wbudowana)       | System         |

### Kluczowe kolumny / Key Columns

#### tt_project
| Kolumna              | Typ        | Opis                    |
|---------------------|------------|-------------------------|
| `tt_projectid`      | UniqueId   | PK                      |
| `tt_name`           | String     | Nazwa projektu          |
| `tt_code`           | String     | Kod projektu            |
| `tt_description`    | Memo       | Opis                    |
| `tt_isactive`       | Boolean    | Czy aktywny             |
| `tt_color`          | String     | Kolor (HEX)             |
| `tt_budgethours`    | Decimal    | Budżet godzinowy        |
| `tt_startdate`      | DateTime   | Data rozpoczęcia        |
| `tt_enddate`        | DateTime   | Data zakończenia        |

#### tt_timeregister
| Kolumna              | Typ        | Opis                    |
|---------------------|------------|-------------------------|
| `tt_timeregisterid` | UniqueId   | PK                      |
| `tt_date`           | DateTime   | Data wpisu              |
| `tt_hours`          | Decimal    | Liczba godzin           |
| `tt_description`    | String     | Opis pracy              |
| `tt_projectid`      | Lookup     | FK → tt_project         |
| `tt_userid`         | Lookup     | FK → systemuser         |
| `tt_status`         | OptionSet  | draft / submitted / approved / rejected |

#### tt_projectuser
| Kolumna              | Typ        | Opis                    |
|---------------------|------------|-------------------------|
| `tt_projectuserid`  | UniqueId   | PK                      |
| `tt_projectid`      | Lookup     | FK → tt_project         |
| `tt_userid`         | Lookup     | FK → systemuser         |
| `tt_role`           | OptionSet  | member / manager        |

#### tt_daysoff
| Kolumna              | Typ        | Opis                    |
|---------------------|------------|-------------------------|
| `tt_daysoffid`      | UniqueId   | PK                      |
| `tt_userid`         | Lookup     | FK → systemuser         |
| `tt_startdate`      | DateTime   | Początek                |
| `tt_enddate`        | DateTime   | Koniec                  |
| `tt_type`           | OptionSet  | vacation / sick / other |
| `tt_description`    | String     | Powód                   |

---

## Rozwiązania / Solutions

### Nazewnictwo / Naming Convention

```
TimeTrack_<Major>_<Minor>_<Patch>_<Build>.zip
TimeTrackCustomConnector_<Major>_<Minor>_<Patch>_<Build>.zip
```

| Wersja | Plik ZIP                                    | Typ       | Uwagi                          |
|--------|---------------------------------------------|-----------|--------------------------------|
| 1.0.0.0 | `TimeTrack_1_0_0_0.zip`                    | Unmanaged | Schemat Dataverse, tabele tt_*, widoki, role |
| 1.0.0.0 | `TimeTrackCustomConnector_1_0_0_0.zip`     | Unmanaged | Custom Connector do web API    |

### Import rozwiązania / Solution Import

```powershell
# Wymagane: Power Platform CLI (pac)
pac auth create --environment "https://your-env.crm4.dynamics.com"

# Import rozwiązania Dataverse (unmanaged)
pac solution import --path ./TimeTrack_1_0_0_0.zip --publish-changes

# Import Custom Connector (unmanaged)
pac solution import --path ./TimeTrackCustomConnector_1_0_0_0.zip --publish-changes
```

> **Uwaga**: Oba pliki ZIP to rozwiązania unmanaged. W środowisku produkcyjnym
> zaleca się eksport jako managed i import managed solution.

---

## Aplikacje / Applications

### Canvas App — Timesheet Mobile

Mobilna aplikacja do rejestracji czasu pracy z poziomu telefonu / tabletu.

- **Funkcje**: dodawanie wpisów czasu, przegląd tygodnia, status urlopów
- **Źródło danych**: Dataverse (direct connection)
- **Lokalizacja**: `canvas-apps/` (eksport ZIP z Power Apps Studio)

### Model-Driven App — Timesheet Admin

Panel administracyjny dla managerów i administratorów.

- **Funkcje**: zarządzanie projektami, przegląd wpisów zespołu, zatwierdzanie/odrzucanie, raporty
- **Źródło danych**: Dataverse (tabele tt_*)
- **Lokalizacja**: zawarte w rozwiązaniu `TimeTrack_1_0_0_0.zip`

### Custom Connector — TimeTrack API

Łącznik do komunikacji między Power Platform a web API Timesheet.

- **Funkcje**: integracja Power Automate / Canvas App z Next.js API routes
- **Plik**: `TimeTrackCustomConnector_1_0_0_0.zip`
- **Konfiguracja**: wymaga URL endpointu web API oraz uwierzytelnienia (Entra ID)

---

## Provisioning

### Pełne środowisko / Full Environment

```powershell
.\Provision-FullEnvironment.ps1 -EnvironmentUrl "https://your-env.crm4.dynamics.com"
```

Skrypt tworzy:
1. Tabele Dataverse (tt_project, tt_projectuser, tt_timeregister, tt_daysoff)
2. Kolumny, typy, relacje
3. Security roles i uprawnienia
4. Widoki systemowe

> **Alternatywa**: Zamiast skryptu możesz zaimportować gotowe rozwiązanie:
> ```powershell
> pac solution import --path ./TimeTrack_1_0_0_0.zip --publish-changes
> pac solution import --path ./TimeTrackCustomConnector_1_0_0_0.zip --publish-changes
> ```

---

## Wymagania / Prerequisites

- **Power Platform CLI** (`pac`) — [Instalacja](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction)
- **Licencja Power Apps** — Per User lub Per App
- **Dataverse environment** — z uprawnieniami System Administrator
- **Azure AD App Registration** — konfiguracja w Setup-EntraId.ps1
