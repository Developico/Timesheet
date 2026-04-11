# Dataverse Schema

## Table of Contents

- [Overview](#overview)
- [Entity Diagram](#entity-diagram)
- [Entities](#entities)
- [Field Configuration](#field-configuration)
- [OData Queries](#odata-queries)

## Overview

The application integrates with Microsoft Dataverse (CRM) as the backend database. Entities are accessed via the OData v4.0 REST API. Field name configuration is fully parameterizable through environment variables (`lib/dataverse-config.ts`).

## Entity Diagram

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
    │ _tt_projectid_value│  → FK to tt_projects
    │ _tt_userid_value   │  → FK to systemusers
    └────────────────────┘

    ┌─────────────────────┐
    │  tt_timeregisters    │
    │  (Time Entries)      │
    ├─────────────────────┤
    │ tt_timeregisterid   │  PK
    │ tt_startdatetime    │  DateTime
    │ tt_duration         │  Duration (min)
    │ _tt_projectid_value │  → FK to tt_projects
    │ _tt_userid_value    │  → FK to systemusers
    │ tt_billable         │  Billable flag
    │ tt_note             │  Note
    │ tt_task             │  Task name
    └─────────────────────┘

    ┌──────────────────┐
    │   tt_daysoffs     │
    │   (Days Off)      │
    ├──────────────────┤
    │ tt_date           │  Date
    │ tt_holidayname    │  Holiday name
    └──────────────────┘
```

## Entities

### systemusers (Consultants)

Standard Dataverse entity — system users.

| Field | Type | Description |
|-------|------|-------------|
| `systemuserid` | GUID | Primary key |
| `fullname` | string | Full name |
| `internalemailaddress` | string | Email address |
| `azureactivedirectoryobjectid` | GUID | Entra ID Object ID |
| `isdisabled` | boolean | Whether disabled |
| `accessmode` | int | Access mode |
| `statecode` | int | Record state (0 = active) |

**Default filter**: `isdisabled eq false`, `accessmode ne 4` (non-support users)

### tt_projects (Projects)

Custom entity — project definitions.

| Field | Type | Description |
|-------|------|-------------|
| `tt_projectid` | GUID | Primary key |
| `tt_name` | string | Project name |
| `tt_code` | string | Project code (e.g., PRJ-001) |
| `tt_client` | string | Client name |
| `tt_billable` | boolean | Billable project |
| `cr815_allusers` | boolean | Available to all users |
| `tt_metaproject` | boolean | Meta-project (e.g., vacation, sick leave) |
| `tt_note` | string | Note |
| `statecode` | int | Record state (0 = active) |

**Default filter**: `statecode eq 0`

### tt_projectusers (Assignments)

Junction table linking consultants to projects (N:M).

| Field | Type | Description |
|-------|------|-------------|
| `_tt_projectid_value` | GUID | Lookup → tt_projects |
| `_tt_userid_value` | GUID | Lookup → systemusers |

### tt_timeregisters (Time Entries)

Custom entity — time registration records.

| Field | Type | Description |
|-------|------|-------------|
| `tt_timeregisterid` | GUID | Primary key |
| `tt_startdatetime` | DateTimeOffset | Start date and time |
| `tt_duration` | int | Duration in minutes |
| `_tt_projectid_value` | GUID | Lookup → tt_projects |
| `_tt_userid_value` | GUID | Lookup → systemusers |
| `tt_billable` | boolean | Billable entry |
| `tt_note` | string | Note / work description |
| `tt_task` | string | Task label |

### tt_daysoffs (Days Off)

Custom entity — holidays and days off.

| Field | Type | Description |
|-------|------|-------------|
| `tt_date` | Date | Date |
| `tt_holidayname` | string | Holiday name |

## Field Configuration

All entity and field names are configured in `lib/dataverse-config.ts`, and values can be overridden via environment variables (see: [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md#dataverse-field-mapping)).

### Configuration Structure

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

## OData Queries

### Dataverse Client

`lib/dataverse-client.ts` — `DataverseClient` class:

- **Authorization**: OAuth 2.0 client credentials (MSAL) → `Bearer` token
- **Retry**: Status 429 (Rate Limit) and 503 (Unavailable) → exponential backoff (3 attempts)
- **Pagination**: `@odata.nextLink` → automatically iterates through pages
- **Timeout**: default timeout per request

### Example Queries

#### Fetch active consultants

```
GET /api/data/v9.2/systemusers
  ?$select=systemuserid,fullname,internalemailaddress,azureactivedirectoryobjectid
  &$filter=isdisabled eq false and accessmode ne 4
```

#### Fetch active projects

```
GET /api/data/v9.2/tt_projects
  ?$select=tt_projectid,tt_name,tt_code,tt_client,tt_billable,cr815_allusers
  &$filter=statecode eq 0
```

#### Fetch time entries in date range

```
GET /api/data/v9.2/tt_timeregisters
  ?$select=tt_timeregisterid,tt_startdatetime,tt_duration,_tt_projectid_value,...
  &$filter=_tt_userid_value eq 'USER-GUID'
    and tt_startdatetime ge 2026-04-01T00:00:00Z
    and tt_startdatetime lt 2026-05-01T00:00:00Z
```

#### Fetch consultant assignments

```
GET /api/data/v9.2/tt_projectusers
  ?$select=_tt_projectid_value
  &$filter=_tt_userid_value eq 'USER-GUID'
```
