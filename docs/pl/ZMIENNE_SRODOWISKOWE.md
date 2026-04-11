# Zmienne środowiskowe

## Spis treści

- [Walidacja](#walidacja)
- [Uwierzytelnianie (wymagane w produkcji)](#uwierzytelnianie-wymagane-w-produkcji)
- [Grupy bezpieczeństwa](#grupy-bezpieczeństwa)
- [Dataverse](#dataverse)
- [Runtime](#runtime)
- [Mapowanie pól Dataverse](#mapowanie-pól-dataverse)
- [Przykład .env.local](#przykład-envlocal)

## Walidacja

Aplikacja waliduje zmienne środowiskowe przy starcie za pomocą schematu Zod (`lib/env.ts`):

- **Produkcja** (`NODE_ENV=production`): brak wymaganych zmiennych powoduje błąd i zatrzymanie (fail-hard)
- **Development**: brak zmiennych generuje ostrzeżenie, aplikacja działa z placeholderami

## Uwierzytelnianie (wymagane w produkcji)

| Zmienna | Wymagana | Opis |
|---------|----------|------|
| `AZURE_AD_CLIENT_ID` | ✅ | ID aplikacji z rejestracji w Entra ID |
| `AZURE_AD_CLIENT_SECRET` | ✅ | Secret aplikacji Entra ID |
| `AZURE_AD_TENANT_ID` | ✅ | ID tenanta Azure |
| `NEXTAUTH_SECRET` | ✅ | Klucz podpisu JWT sesji (min. 32 znaki, losowy) |
| `NEXTAUTH_URL` | Nie | URL callbacku (auto-detected, potrzebny za reverse proxy) |
| `AZURE_AD_APP_SCOPE` | Nie | Custom scope aplikacji (np. `api://APP_ID/access_as_user`) |

## Grupy bezpieczeństwa

Role RBAC mapowane z grup w Entra ID. Preferowane nazwy serwerowe:

| Zmienna | Opis |
|---------|------|
| `ADMIN_GROUP_ID` | ID grupy Administratorów |
| `CONSULTANT_GROUP_ID` | ID grupy Konsultantów |

Alternatywne (backward compat):

| Zmienna | Opis |
|---------|------|
| `NEXT_PUBLIC_ADMIN_GROUP` | Legacy — ID grupy admin |
| `NEXT_PUBLIC_CONSULTANT_GROUP` | Legacy — ID grupy konsultantów |
| `AZURE_AD_CONSULTANTS_GROUP_ID` | Legacy — ID grupy konsultantów |
| `CONSULTANTS_GROUP_ID` | Legacy — ID grupy konsultantów |

> Priorytet: `ADMIN_GROUP_ID` > `NEXT_PUBLIC_ADMIN_GROUP`; `CONSULTANT_GROUP_ID` > `NEXT_PUBLIC_CONSULTANT_GROUP` > `AZURE_AD_CONSULTANTS_GROUP_ID` > `CONSULTANTS_GROUP_ID`

## Dataverse

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `DATAVERSE_ENABLED` | `false` | `true` aby włączyć integrację Dataverse |
| `DATAVERSE_URL` | — | URL instancji Dataverse (np. `https://org.crm4.dynamics.com`) |
| `DATAVERSE_TENANT_ID` | — | ID tenanta (jeśli inny niż `AZURE_AD_TENANT_ID`) |
| `DATAVERSE_CLIENT_ID` | — | ID aplikacji z uprawnieniami do Dataverse |
| `DATAVERSE_CLIENT_SECRET` | — | Secret aplikacji Dataverse |

## Runtime

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `NEXT_PUBLIC_USE_MOCK` | `true` | `true` = dane mock, `false` = Dataverse |
| `LOG_MODE` | `console` | `console` / `file` / `silent` |
| `VOLATILE_STORE_PERSIST` | `false` | `true` = trwałe przechowywanie tokenów (dev only) |

## Mapowanie pól Dataverse

Wszystkie nazwy logiczne encji i pól można nadpisać przez zmienne środowiskowe. Domyślne wartości zdefiniowane w `lib/dataverse-config.ts`.

### Konsultanci (systemusers)

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `DATAVERSE_ENTITY_CONSULTANT` | `systemusers` | Nazwa entity set |
| `DATAVERSE_FIELD_CONSULTANT_ID` | `systemuserid` | Pole ID |
| `DATAVERSE_FIELD_CONSULTANT_FULLNAME` | `fullname` | Pole pełnej nazwy |
| `DATAVERSE_FIELD_CONSULTANT_EMAIL` | `internalemailaddress` | Pole e-mail |
| `DATAVERSE_FIELD_CONSULTANT_AVATAR` | _(puste)_ | Pole avatara (custom) |
| `DATAVERSE_FIELD_CONSULTANT_STATE` | _(puste)_ | Pole statecode (custom) |
| `DATAVERSE_FIELD_CONSULTANT_DISABLED` | `isdisabled` | Flaga wyłączenia |
| `DATAVERSE_FIELD_CONSULTANT_ACCESSMODE` | `accessmode` | Tryb dostępu |
| `DATAVERSE_FIELD_CONSULTANT_AAD_OID` | `azureactivedirectoryobjectid` | Azure AD Object ID |

### Projekty (tt_projects)

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `DATAVERSE_ENTITY_PROJECT` | `tt_projects` | Nazwa entity set |
| `DATAVERSE_FIELD_PROJECT_ID` | `tt_projectid` | Pole ID |
| `DATAVERSE_FIELD_PROJECT_NAME` | `tt_name` | Nazwa projektu |
| `DATAVERSE_FIELD_PROJECT_CODE` | `tt_code` | Kod projektu |
| `DATAVERSE_FIELD_PROJECT_CLIENT` | `tt_client` | Klient |
| `DATAVERSE_FIELD_PROJECT_BILLABLE` | `tt_billable` | Flaga billable |
| `DATAVERSE_FIELD_PROJECT_META` | `tt_metaproject` | Meta projekt |
| `DATAVERSE_FIELD_PROJECT_NOTE` | `tt_note` | Notatka |
| `DATAVERSE_FIELD_PROJECT_ALLUSERS` | `cr815_allusers` | Flaga "wszyscy użytkownicy" |
| `DATAVERSE_FIELD_PROJECT_STATE` | `statecode` | Stan rekordu |

### Przypisania (tt_projectusers)

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `DATAVERSE_ENTITY_PROJECTUSER` | `tt_projectusers` | Nazwa entity set |
| `DATAVERSE_FIELD_PROJECTUSER_PROJECT` | `_tt_projectid_value` | Lookup projektu |
| `DATAVERSE_FIELD_PROJECTUSER_USER` | `_tt_userid_value` | Lookup użytkownika |

### Rejestracja czasu (tt_timeregisters)

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `DATAVERSE_ENTITY_TIMEREGISTER` | `tt_timeregisters` | Nazwa entity set |
| `DATAVERSE_FIELD_TR_START` | `tt_startdatetime` | Data/czas rozpoczęcia |
| `DATAVERSE_FIELD_TR_DURATION` | `tt_duration` | Czas trwania (minuty) |
| `DATAVERSE_FIELD_TR_PROJECT` | `_tt_projectid_value` | Lookup projektu |
| `DATAVERSE_FIELD_TR_USER` | `_tt_userid_value` | Lookup użytkownika |
| `DATAVERSE_FIELD_TR_BILLABLE` | _(puste)_ | Flaga billable (custom) |
| `DATAVERSE_FIELD_TR_NOTE` | `tt_note` | Notatka |
| `DATAVERSE_FIELD_TR_TASK` | `tt_task` | Nazwa zadania |

### Dni wolne (tt_daysoffs)

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `DATAVERSE_ENTITY_DAYSOFF` | `tt_daysoffs` | Nazwa entity set |
| `DATAVERSE_FIELD_DAYSOFF_DATE` | `tt_date` | Pole daty |
| `DATAVERSE_FIELD_DAYSOFF_NAME` | `tt_holidayname` | Nazwa święta |

## Przykład .env.local

```env
# === Tryb mock (domyślny, bez Azure) ===
NEXT_PUBLIC_USE_MOCK=true

# === Produkcja: Entra ID ===
AZURE_AD_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXTAUTH_SECRET=your-random-secret-at-least-32-chars

# === Grupy RBAC ===
ADMIN_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CONSULTANT_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# === Dataverse (opcjonalnie) ===
DATAVERSE_ENABLED=true
DATAVERSE_URL=https://yourorg.crm4.dynamics.com
DATAVERSE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DATAVERSE_CLIENT_SECRET=your-dataverse-secret

# === Runtime ===
LOG_MODE=console
```
