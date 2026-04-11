# Schemat Dataverse

## Spis treści

- [Przegląd](#przegląd)
- [Diagram encji](#diagram-encji)
- [Encje](#encje)
- [Konfiguracja pól](#konfiguracja-pól)
- [OData queries](#odata-queries)

## Przegląd

Aplikacja integruje się z Microsoft Dataverse (CRM) jako backendową bazą danych. Encje dostępne są przez OData v4.0 REST API. Konfiguracja nazw pól jest w pełni parametryzowalna przez zmienne środowiskowe (`lib/dataverse-config.ts`).

## Diagram encji

```
┌───────────────────┐       ┌───────────────────┐
│   systemusers     │       │    tt_projects     │
│   (Consultants)   │       │    (Projects)      │
├───────────────────┤       ├───────────────────┤
│ systemuserid (PK) │       │ tt_projectid (PK) │
│ fullname          │       │ tt_name           │
│ internalemailaddr │       │ tt_code           │
│ azureactivedir..  │       │ tt_client         │
│ isdisabled        │       │ tt_billable       │
│ accessmode        │       │ cr815_allusers    │
│ statecode         │       │ tt_metaproject    │
└────────┬──────────┘       │ tt_note           │
         │                  │ statecode         │
         │ 1:N              └────────┬──────────┘
         │                           │ 1:N
         │  ┌────────────────────────┘
         │  │
    ┌────┴──┴───────────┐
    │  tt_projectusers   │
    │  (Assignments)     │
    ├────────────────────┤
    │ _tt_projectid_value│  → FK do tt_projects
    │ _tt_userid_value   │  → FK do systemusers
    └────────────────────┘

    ┌─────────────────────┐
    │  tt_timeregisters    │
    │  (Time Entries)      │
    ├─────────────────────┤
    │ tt_timeregisterid   │  PK
    │ tt_startdatetime    │  Data/czas
    │ tt_duration         │  Czas trwania (min)
    │ _tt_projectid_value │  → FK do tt_projects
    │ _tt_userid_value    │  → FK do systemusers
    │ tt_billable         │  Billable flag
    │ tt_note             │  Notatka
    │ tt_task             │  Nazwa zadania
    └─────────────────────┘

    ┌──────────────────┐
    │   tt_daysoffs     │
    │   (Days Off)      │
    ├──────────────────┤
    │ tt_date           │  Data
    │ tt_holidayname    │  Nazwa święta
    └──────────────────┘
```

## Encje

### systemusers (Konsultanci)

Standardowa encja Dataverse — użytkownicy systemu.

| Pole | Typ | Opis |
|------|-----|------|
| `systemuserid` | GUID | Klucz główny |
| `fullname` | string | Imię i nazwisko |
| `internalemailaddress` | string | Adres e-mail |
| `azureactivedirectoryobjectid` | GUID | Entra ID Object ID |
| `isdisabled` | boolean | Czy wyłączony |
| `accessmode` | int | Tryb dostępu |
| `statecode` | int | Stan rekordu (0 = aktywny) |

**Filtr domyślny**: `isdisabled eq false`, `accessmode ne 4` (non-support users)

### tt_projects (Projekty)

Custom entity — definicje projektów.

| Pole | Typ | Opis |
|------|-----|------|
| `tt_projectid` | GUID | Klucz główny |
| `tt_name` | string | Nazwa projektu |
| `tt_code` | string | Kod projektu (np. PRJ-001) |
| `tt_client` | string | Nazwa klienta |
| `tt_billable` | boolean | Projekt rozliczalny |
| `cr815_allusers` | boolean | Dostępny dla wszystkich |
| `tt_metaproject` | boolean | Meta-projekt (np. urlop, choroba) |
| `tt_note` | string | Notatka |
| `statecode` | int | Stan rekordu (0 = aktywny) |

**Filtr domyślny**: `statecode eq 0`

### tt_projectusers (Przypisania)

Tabela łącząca konsultantów z projektami (N:M).

| Pole | Typ | Opis |
|------|-----|------|
| `_tt_projectid_value` | GUID | Lookup → tt_projects |
| `_tt_userid_value` | GUID | Lookup → systemusers |

### tt_timeregisters (Rejestracja czasu)

Custom entity — wpisy czasu pracy.

| Pole | Typ | Opis |
|------|-----|------|
| `tt_timeregisterid` | GUID | Klucz główny |
| `tt_startdatetime` | DateTimeOffset | Data i czas rozpoczęcia |
| `tt_duration` | int | Czas trwania w minutach |
| `_tt_projectid_value` | GUID | Lookup → tt_projects |
| `_tt_userid_value` | GUID | Lookup → systemusers |
| `tt_billable` | boolean | Wpis rozliczalny |
| `tt_note` | string | Notatka / opis pracy |
| `tt_task` | string | Etykieta zadania |

### tt_daysoffs (Dni wolne)

Custom entity — święta i dni wolne.

| Pole | Typ | Opis |
|------|-----|------|
| `tt_date` | Date | Data wolnego |
| `tt_holidayname` | string | Nazwa święta |

## Konfiguracja pól

Wszystkie nazwy encji i pól konfigurowane są w `lib/dataverse-config.ts`, a wartości można nadpisać zmiennymi środowiskowymi (patrz: [ZMIENNE_SRODOWISKOWE.md](ZMIENNE_SRODOWISKOWE.md#mapowanie-pól-dataverse)).

### Struktura konfiguracji

```typescript
const config = {
  consultant: {
    entitySet: process.env.DATAVERSE_ENTITY_CONSULTANT || 'systemusers',
    fields: {
      id: process.env.DATAVERSE_FIELD_CONSULTANT_ID || 'systemuserid',
      fullname: process.env.DATAVERSE_FIELD_CONSULTANT_FULLNAME || 'fullname',
      // ...
    }
  },
  project: { /* ... */ },
  projectUser: { /* ... */ },
  timeRegister: { /* ... */ },
  daysOff: { /* ... */ }
}
```

## OData queries

### Klient Dataverse

`lib/dataverse-client.ts` — klasa `DataverseClient`:

- **Autoryzacja**: OAuth 2.0 client credentials (MSAL) → `Bearer` token
- **Retry**: Status 429 (Rate Limit) i 503 (Unavailable) → exponential backoff (3 próby)
- **Paginacja**: `@odata.nextLink` → automatycznie iteruje po stronach
- **Timeout**: domyślny timeout na żądanie

### Przykłady zapytań

#### Pobierz aktywnych konsultantów

```
GET /api/data/v9.2/systemusers
  ?$select=systemuserid,fullname,internalemailaddress,azureactivedirectoryobjectid
  &$filter=isdisabled eq false and accessmode ne 4
```

#### Pobierz projekty aktywne

```
GET /api/data/v9.2/tt_projects
  ?$select=tt_projectid,tt_name,tt_code,tt_client,tt_billable,cr815_allusers
  &$filter=statecode eq 0
```

#### Pobierz wpisy czasu w zakresie dat

```
GET /api/data/v9.2/tt_timeregisters
  ?$select=tt_timeregisterid,tt_startdatetime,tt_duration,_tt_projectid_value,...
  &$filter=_tt_userid_value eq 'USER-GUID'
    and tt_startdatetime ge 2026-04-01T00:00:00Z
    and tt_startdatetime lt 2026-05-01T00:00:00Z
```

#### Pobierz przypisania konsultanta

```
GET /api/data/v9.2/tt_projectusers
  ?$select=_tt_projectid_value
  &$filter=_tt_userid_value eq 'USER-GUID'
```
