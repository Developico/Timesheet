# Environment Variables

## Table of Contents

- [Validation](#validation)
- [Authentication (required in production)](#authentication-required-in-production)
- [Security Groups](#security-groups)
- [Dataverse](#dataverse)
- [Runtime](#runtime)
- [Dataverse Field Mapping](#dataverse-field-mapping)
- [Example .env.local](#example-envlocal)

## Validation

The application validates environment variables at startup using a Zod schema (`lib/env.ts`):

- **Production** (`NODE_ENV=production`): missing required variables cause a hard failure at startup
- **Development**: missing variables generate warnings, the app runs with placeholders

## Authentication (required in production)

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_AD_CLIENT_ID` | ✅ | App ID from Entra ID registration |
| `AZURE_AD_CLIENT_SECRET` | ✅ | App secret from Entra ID |
| `AZURE_AD_TENANT_ID` | ✅ | Azure tenant ID |
| `NEXTAUTH_SECRET` | ✅ | JWT session signing key (min. 32 chars, random) |
| `NEXTAUTH_URL` | No | Callback URL (auto-detected, needed behind reverse proxy) |
| `AZURE_AD_APP_SCOPE` | No | Custom app scope (e.g., `api://APP_ID/access_as_user`) |

## Security Groups

RBAC roles are mapped from Entra ID groups. Preferred server-side names:

| Variable | Description |
|----------|-------------|
| `ADMIN_GROUP_ID` | Admin group Object ID |
| `CONSULTANT_GROUP_ID` | Consultant group Object ID |

Legacy alternatives (backward compat):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_ADMIN_GROUP` | Legacy — admin group ID |
| `NEXT_PUBLIC_CONSULTANT_GROUP` | Legacy — consultant group ID |
| `AZURE_AD_CONSULTANTS_GROUP_ID` | Legacy — consultant group ID |
| `CONSULTANTS_GROUP_ID` | Legacy — consultant group ID |

> Priority: `ADMIN_GROUP_ID` > `NEXT_PUBLIC_ADMIN_GROUP`; `CONSULTANT_GROUP_ID` > `NEXT_PUBLIC_CONSULTANT_GROUP` > `AZURE_AD_CONSULTANTS_GROUP_ID` > `CONSULTANTS_GROUP_ID`

## Dataverse

| Variable | Default | Description |
|----------|---------|-------------|
| `DATAVERSE_ENABLED` | `false` | `true` to enable Dataverse integration |
| `DATAVERSE_URL` | — | Dataverse instance URL (e.g., `https://org.crm4.dynamics.com`) |
| `DATAVERSE_TENANT_ID` | — | Tenant ID (if different from `AZURE_AD_TENANT_ID`) |
| `DATAVERSE_CLIENT_ID` | — | App ID with Dataverse permissions |
| `DATAVERSE_CLIENT_SECRET` | — | Dataverse app secret |

## Runtime

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `NEXT_PUBLIC_USE_MOCK` | `true` | `true` = mock data, `false` = Dataverse |
| `LOG_MODE` | `console` | `console` / `file` / `silent` |
| `VOLATILE_STORE_PERSIST` | `false` | `true` = persist tokens (dev only) |

## Dataverse Field Mapping

All entity and field logical names can be overridden via environment variables. Default values are defined in `lib/dataverse-config.ts`.

### Consultants (systemusers)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATAVERSE_ENTITY_CONSULTANT` | `systemusers` | Entity set name |
| `DATAVERSE_FIELD_CONSULTANT_ID` | `systemuserid` | ID field |
| `DATAVERSE_FIELD_CONSULTANT_FULLNAME` | `fullname` | Full name field |
| `DATAVERSE_FIELD_CONSULTANT_EMAIL` | `internalemailaddress` | Email field |
| `DATAVERSE_FIELD_CONSULTANT_AVATAR` | _(empty)_ | Avatar field (custom) |
| `DATAVERSE_FIELD_CONSULTANT_STATE` | _(empty)_ | Statecode field (custom) |
| `DATAVERSE_FIELD_CONSULTANT_DISABLED` | `isdisabled` | Disabled flag |
| `DATAVERSE_FIELD_CONSULTANT_ACCESSMODE` | `accessmode` | Access mode |
| `DATAVERSE_FIELD_CONSULTANT_AAD_OID` | `azureactivedirectoryobjectid` | Azure AD Object ID |

### Projects (tt_projects)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATAVERSE_ENTITY_PROJECT` | `tt_projects` | Entity set name |
| `DATAVERSE_FIELD_PROJECT_ID` | `tt_projectid` | ID field |
| `DATAVERSE_FIELD_PROJECT_NAME` | `tt_name` | Project name |
| `DATAVERSE_FIELD_PROJECT_CODE` | `tt_code` | Project code |
| `DATAVERSE_FIELD_PROJECT_CLIENT` | `tt_client` | Client |
| `DATAVERSE_FIELD_PROJECT_BILLABLE` | `tt_billable` | Billable flag |
| `DATAVERSE_FIELD_PROJECT_META` | `tt_metaproject` | Meta project |
| `DATAVERSE_FIELD_PROJECT_NOTE` | `tt_note` | Note |
| `DATAVERSE_FIELD_PROJECT_ALLUSERS` | `cr815_allusers` | All users flag |
| `DATAVERSE_FIELD_PROJECT_STATE` | `statecode` | Record state |

### Assignments (tt_projectusers)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATAVERSE_ENTITY_PROJECTUSER` | `tt_projectusers` | Entity set name |
| `DATAVERSE_FIELD_PROJECTUSER_PROJECT` | `_tt_projectid_value` | Project lookup |
| `DATAVERSE_FIELD_PROJECTUSER_USER` | `_tt_userid_value` | User lookup |

### Time Registration (tt_timeregisters)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATAVERSE_ENTITY_TIMEREGISTER` | `tt_timeregisters` | Entity set name |
| `DATAVERSE_FIELD_TR_START` | `tt_startdatetime` | Start datetime |
| `DATAVERSE_FIELD_TR_DURATION` | `tt_duration` | Duration (minutes) |
| `DATAVERSE_FIELD_TR_PROJECT` | `_tt_projectid_value` | Project lookup |
| `DATAVERSE_FIELD_TR_USER` | `_tt_userid_value` | User lookup |
| `DATAVERSE_FIELD_TR_BILLABLE` | _(empty)_ | Billable flag (custom) |
| `DATAVERSE_FIELD_TR_NOTE` | `tt_note` | Note |
| `DATAVERSE_FIELD_TR_TASK` | `tt_task` | Task name |

### Days Off (tt_daysoffs)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATAVERSE_ENTITY_DAYSOFF` | `tt_daysoffs` | Entity set name |
| `DATAVERSE_FIELD_DAYSOFF_DATE` | `tt_date` | Date field |
| `DATAVERSE_FIELD_DAYSOFF_NAME` | `tt_holidayname` | Holiday name |

## Example .env.local

```env
# === Mock mode (default, no Azure) ===
NEXT_PUBLIC_USE_MOCK=true

# === Production: Entra ID ===
AZURE_AD_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXTAUTH_SECRET=your-random-secret-at-least-32-chars

# === RBAC Groups ===
ADMIN_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CONSULTANT_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# === Dataverse (optional) ===
DATAVERSE_ENABLED=true
DATAVERSE_URL=https://yourorg.crm4.dynamics.com
DATAVERSE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DATAVERSE_CLIENT_SECRET=your-dataverse-secret

# === Runtime ===
LOG_MODE=console
```
