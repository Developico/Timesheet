# REST API Documentation

## Table of Contents

- [Authentication](#authentication)
- [Response Format](#response-format)
- [Health & Status](#health--status)
- [User Profile](#user-profile)
- [Consultants](#consultants)
- [Projects](#projects)
- [Time Entries](#time-entries)
- [Project Assignments](#project-assignments)
- [Project Team](#project-team)
- [Days Off](#days-off)
- [Graph API](#graph-api)
- [Reports](#reports)
- [Error Codes](#error-codes)

## Authentication

Most endpoints require a valid NextAuth.js session (JWT in httpOnly cookie). Endpoints use the `requireAuth(req)` guard from `lib/api-auth-guard.ts`.

### Headers

The session is automatically passed via browser cookies. No `Authorization` header is required for standard frontend calls.

### Roles

| Role | Access |
|------|--------|
| `Consultant` | Read/write own data |
| `Administrator` | Full access + reports |
| `Unauthorized` | No access (401) |

## Response Format

### Success

```json
{
  "data": [...],
  "meta": { "cid": "proj-abc12345" }
}
```

### Error

```json
{
  "error": "Error description",
  "code": "VALIDATION_FAILED",
  "details": {}
}
```

---

## Health & Status

### GET /api/health

Checks application status and data source connectivity.

**Auth**: Not required

**Response 200**:

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

## User Profile

### GET /api/me

Returns the current user's data from the JWT token.

**Auth**: Required

**Response 200**:

```json
{
  "id": "user-uuid",
  "name": "John Smith",
  "email": "john@example.com",
  "role": "Consultant",
  "roles": ["Consultant"],
  "hasPhoto": true
}
```

**Response 401**: No session

### GET /api/me/photo

Fetches the current user's profile photo from Microsoft Graph.

**Auth**: Required (Graph access token)

**Response 200**: Binary (image/jpeg)

**Response 204**: No photo available

**Response 401**: No token

---

## Consultants

### GET /api/dataverse/consultants

Returns a list of consultants from the active data source.

**Auth**: Required

**Response 200**:

```json
{
  "data": [
    {
      "id": "consultant-uuid",
      "name": "John Smith",
      "email": "john@example.com",
      "aadObjectId": "entra-uuid",
      "isActive": true
    }
  ],
  "meta": { "cid": "cons-abc123" }
}
```

---

## Projects

### GET /api/dataverse/projects

Returns a list of projects. If the logged-in user is a consultant, the `assigned` field indicates assignment.

**Auth**: Required

**Response 200**:

```json
{
  "data": [
    {
      "id": "project-uuid",
      "code": "PRJ-001",
      "name": "Project Name",
      "client": "Client",
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

## Time Entries

### GET /api/dataverse/timeentries

Returns time entries with filters.

**Auth**: Required

**Query parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | Yes | Start date (YYYY-MM-DD) |
| `to` | string | Yes | End date (YYYY-MM-DD) |
| `consultantId` | string | No | Consultant ID (defaults to logged-in user) |
| `billable` | string | No | `true` / `false` / `all` |
| `projectIds` | string | No | Comma-separated project IDs |

**Response 200**:

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
      "note": "Work description",
      "task": "Development"
    }
  ]
}
```

**Response 400**: Invalid parameters (Zod validation)

---

## Project Assignments

### GET /api/dataverse/project-assignments

Returns an array of project IDs assigned to a consultant.

**Auth**: Required

**Query parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `consultantId` | string | No | Consultant ID (defaults to OID from token) |

**Response 200**:

```json
{
  "data": ["project-uuid-1", "project-uuid-2"]
}
```

---

## Project Team

### GET /api/dataverse/project-team

Returns an array of consultant IDs assigned to a project.

**Auth**: Required

**Query parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | Yes | Project ID |

**Response 200**:

```json
{
  "data": ["consultant-uuid-1", "consultant-uuid-2"]
}
```

**Response 400**: Missing `projectId`

**Response 501**: Data source does not support this operation

---

## Days Off

### GET /api/dataverse/days-off

Returns a list of holidays/days off in the given date range.

**Auth**: Required

**Query parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | Yes | Start date (YYYY-MM-DD) |
| `to` | string | Yes | End date (YYYY-MM-DD) |

**Response 200**:

```json
{
  "data": [
    { "date": "2026-05-01", "name": "Labour Day" },
    { "date": "2026-05-03", "name": "Constitution Day" }
  ]
}
```

---

## Graph API

### GET /api/graph/consultants

Fetches consultant group members from Microsoft Graph (client credentials). Maps `aadObjectId` to Dataverse ID.

**Auth**: Required (NextAuth session)

**Response 200**:

```json
{
  "members": [
    {
      "aadObjectId": "entra-uuid",
      "name": "John Smith",
      "email": "john@example.com",
      "consultantId": "dataverse-uuid"
    }
  ]
}
```

### GET /api/graph/users/[id]/photo

Fetches a specific user's profile photo from Graph.

**Auth**: Required

**Response 200**: Binary (image/jpeg)

**Response 204**: No photo available

---

## Reports

### GET /api/reports/data

Generates aggregated report data.

**Auth**: Required (`Administrator` role)

**Query parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dateFrom` | string | Yes | Start date (YYYY-MM-DD) |
| `dateTo` | string | Yes | End date (YYYY-MM-DD) |
| `groupBy` | string | Yes | `consultant` / `project` / `client` |
| `projectIds` | string | No | Comma-separated project IDs |
| `consultantIds` | string | No | Comma-separated consultant IDs |
| `billable` | string | No | `all` / `billable` / `non-billable` |
| `includeTasks` | string | No | `true` / `false` |

**Response 200**: `ReportResult` (see `types/reports.ts`)

**Response 403**: Insufficient permissions

### POST /api/reports/pdf

Generates a report in PDF format from provided data.

**Auth**: Required (`Administrator` role)

**Body**: `ReportResult` (JSON)

**Response 200**: Binary (application/pdf)

**Response 403**: Insufficient permissions

---

## Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_FAILED` | Invalid parameters (Zod validation) |
| 401 | `unauthorized` | No valid session |
| 403 | `ADMIN_REQUIRED` | Requires Administrator role |
| 429 | `Too many requests` | Rate limiting (`Retry-After` header) |
| 500 | — | Internal server error |
| 501 | — | Operation not supported by data source |
| 502 | `graph_error` | Microsoft Graph API error |
