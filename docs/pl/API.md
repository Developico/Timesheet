# Dokumentacja REST API

## Spis treści

- [Uwierzytelnianie](#uwierzytelnianie)
- [Format odpowiedzi](#format-odpowiedzi)
- [Health & Status](#health--status)
- [Profil użytkownika](#profil-użytkownika)
- [Konsultanci](#konsultanci)
- [Projekty](#projekty)
- [Wpisy czasu](#wpisy-czasu)
- [Przypisania projektowe](#przypisania-projektowe)
- [Zespół projektu](#zespół-projektu)
- [Dni wolne](#dni-wolne)
- [Graph API](#graph-api)
- [Raporty](#raporty)
- [Kody błędów](#kody-błędów)

## Uwierzytelnianie

Większość endpointów wymaga ważnej sesji NextAuth.js (JWT w httpOnly cookie). Endpointy używają guardu `requireAuth(req)` z `lib/api-auth-guard.ts`.

### Nagłówki

Sesja jest automatycznie przekazywana przez cookie przeglądarki. Nie jest wymagany nagłówek `Authorization` dla standardowych wywołań z frontendu.

### Role

| Rola | Dostęp |
|------|--------|
| `Consultant` | Odczyt/zapis własnych danych |
| `Administrator` | Pełny dostęp + raporty |
| `Unauthorized` | Brak dostępu (401) |

## Format odpowiedzi

### Sukces

```json
{
  "data": [...],
  "meta": { "cid": "proj-abc12345" }
}
```

### Błąd

```json
{
  "error": "Opis błędu",
  "code": "VALIDATION_FAILED",
  "details": {}
}
```

---

## Health & Status

### GET /api/health

Sprawdza stan aplikacji i połączenia z data source.

**Auth**: Nie wymagane

**Odpowiedź 200**:

```json
{
  "status": "ok",
  "dataSource": "mock",
  "dataverse": { "enabled": false, "reason": "DATAVERSE_ENABLED not true" },
  "sample": { "projects": [] },
  "ms": 12
}
```

---

## Profil użytkownika

### GET /api/me

Zwraca dane zalogowanego użytkownika z tokenu JWT.

**Auth**: Wymagane

**Odpowiedź 200**:

```json
{
  "id": "user-uuid",
  "name": "Jan Kowalski",
  "email": "jan@example.com",
  "role": "Consultant",
  "roles": ["Consultant"],
  "hasPhoto": true
}
```

**Odpowiedź 401**: Brak sesji

### GET /api/me/photo

Pobiera zdjęcie profilowe zalogowanego użytkownika z Microsoft Graph.

**Auth**: Wymagane (access token do Graph)

**Odpowiedź 200**: Binary (image/jpeg)

**Odpowiedź 204**: Brak zdjęcia

**Odpowiedź 401**: Brak tokenu

---

## Konsultanci

### GET /api/dataverse/consultants

Zwraca listę konsultantów z aktywnego data source.

**Auth**: Wymagane

**Odpowiedź 200**:

```json
{
  "data": [
    {
      "id": "consultant-uuid",
      "name": "Jan Kowalski",
      "email": "jan@example.com",
      "aadObjectId": "entra-uuid",
      "isActive": true
    }
  ],
  "meta": { "cid": "cons-abc123" }
}
```

---

## Projekty

### GET /api/dataverse/projects

Zwraca listę projektów. Jeśli zalogowany użytkownik jest konsultantem, pole `assigned` wskazuje przypisanie.

**Auth**: Wymagane

**Odpowiedź 200**:

```json
{
  "data": [
    {
      "id": "project-uuid",
      "code": "PRJ-001",
      "name": "Nazwa projektu",
      "client": "Klient",
      "billable": true,
      "assigned": true,
      "color": "#3B82F6",
      "allUsers": false
    }
  ],
  "meta": { "cid": "proj-abc123" }
}
```

---

## Wpisy czasu

### GET /api/dataverse/timeentries

Zwraca wpisy czasu pracy z filtrami.

**Auth**: Wymagane

**Parametry query**:

| Parametr | Typ | Wymagany | Opis |
|----------|-----|----------|------|
| `from` | string | Tak | Data początkowa (YYYY-MM-DD) |
| `to` | string | Tak | Data końcowa (YYYY-MM-DD) |
| `consultantId` | string | Nie | ID konsultanta (domyślnie: zalogowany) |
| `billable` | string | Nie | `true` / `false` / `all` |
| `projectIds` | string | Nie | Lista ID projektów (rozdzielona przecinkami) |

**Odpowiedź 200**:

```json
{
  "data": [
    {
      "id": "entry-uuid",
      "date": "2026-04-11",
      "consultantId": "consultant-uuid",
      "projectId": "project-uuid",
      "hours": 4.5,
      "billable": true,
      "note": "Opis pracy",
      "task": "Development"
    }
  ]
}
```

**Odpowiedź 400**: Nieprawidłowe parametry (walidacja Zod)

---

## Przypisania projektowe

### GET /api/dataverse/project-assignments

Zwraca tablicę ID projektów przypisanych do konsultanta.

**Auth**: Wymagane

**Parametry query**:

| Parametr | Typ | Wymagany | Opis |
|----------|-----|----------|------|
| `consultantId` | string | Nie | ID konsultanta (domyślnie: mapowany z OID tokenu) |

**Odpowiedź 200**:

```json
{
  "data": ["project-uuid-1", "project-uuid-2"]
}
```

---

## Zespół projektu

### GET /api/dataverse/project-team

Zwraca tablicę ID konsultantów przypisanych do projektu.

**Auth**: Wymagane

**Parametry query**:

| Parametr | Typ | Wymagany | Opis |
|----------|-----|----------|------|
| `projectId` | string | Tak | ID projektu |

**Odpowiedź 200**:

```json
{
  "data": ["consultant-uuid-1", "consultant-uuid-2"]
}
```

**Odpowiedź 400**: Brak `projectId`

**Odpowiedź 501**: Data source nie wspiera tej operacji

---

## Dni wolne

### GET /api/dataverse/days-off

Zwraca listę dni wolnych / świąt w podanym zakresie.

**Auth**: Wymagane

**Parametry query**:

| Parametr | Typ | Wymagany | Opis |
|----------|-----|----------|------|
| `from` | string | Tak | Data początkowa (YYYY-MM-DD) |
| `to` | string | Tak | Data końcowa (YYYY-MM-DD) |

**Odpowiedź 200**:

```json
{
  "data": [
    { "date": "2026-05-01", "name": "Święto Pracy" },
    { "date": "2026-05-03", "name": "Święto Konstytucji" }
  ]
}
```

---

## Graph API

### GET /api/graph/consultants

Pobiera członków grupy konsultantów z Microsoft Graph (client credentials). Mapuje `aadObjectId` na ID Dataverse.

**Auth**: Wymagane (sesja NextAuth)

**Odpowiedź 200**:

```json
{
  "members": [
    {
      "aadObjectId": "entra-uuid",
      "name": "Jan Kowalski",
      "email": "jan@example.com",
      "consultantId": "dataverse-uuid"
    }
  ]
}
```

### GET /api/graph/users/[id]/photo

Pobiera zdjęcie profilowe konkretnego użytkownika z Graph.

**Auth**: Wymagane

**Odpowiedź 200**: Binary (image/jpeg)

**Odpowiedź 204**: Brak zdjęcia

---

## Raporty

### GET /api/reports/data

Generuje zagregowane dane raportowe.

**Auth**: Wymagane (rola `Administrator`)

**Parametry query**:

| Parametr | Typ | Wymagany | Opis |
|----------|-----|----------|------|
| `dateFrom` | string | Tak | Data początkowa (YYYY-MM-DD) |
| `dateTo` | string | Tak | Data końcowa (YYYY-MM-DD) |
| `groupBy` | string | Tak | `consultant` / `project` / `client` |
| `projectIds` | string | Nie | ID projektów (rozdzielone przecinkami) |
| `consultantIds` | string | Nie | ID konsultantów (rozdzielone przecinkami) |
| `billable` | string | Nie | `all` / `billable` / `non-billable` |
| `includeTasks` | string | Nie | `true` / `false` |

**Odpowiedź 200**: `ReportResult` (patrz `types/reports.ts`)

**Odpowiedź 403**: Brak uprawnień administratora

### POST /api/reports/pdf

Generuje raport w formacie PDF z przekazanych danych.

**Auth**: Wymagane (rola `Administrator`)

**Body**: `ReportResult` (JSON)

**Odpowiedź 200**: Binary (application/pdf)

**Odpowiedź 403**: Brak uprawnień administratora

---

## Kody błędów

| Status | Kod | Opis |
|--------|-----|------|
| 400 | `VALIDATION_FAILED` | Nieprawidłowe parametry (walidacja Zod) |
| 401 | `unauthorized` | Brak ważnej sesji |
| 403 | `ADMIN_REQUIRED` | Wymaga roli Administrator |
| 429 | `Too many requests` | Rate limiting (nagłówek `Retry-After`) |
| 500 | — | Błąd wewnętrzny serwera |
| 501 | — | Operacja niewspierana przez data source |
| 502 | `graph_error` | Błąd Microsoft Graph API |
