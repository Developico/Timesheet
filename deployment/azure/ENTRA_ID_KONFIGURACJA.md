# Konfiguracja Microsoft Entra ID

## Przegląd

Aplikacja wymaga rejestracji w Microsoft Entra ID (dawniej Azure AD) do uwierzytelniania użytkowników i autoryzacji dostępu do Microsoft Graph oraz Dataverse.

## 1. Rejestracja aplikacji

### Portal

1. Azure Portal → Microsoft Entra ID → App registrations → **New registration**
2. Wypełnij:
   - **Name**: `Developico Timesheet`
   - **Supported account types**: Single tenant (Accounts in this organizational directory only)
   - **Redirect URI**: Web → `https://yourdomain/api/auth/callback/azure-ad`
3. Kliknij **Register**

### Azure CLI

```bash
az ad app create \
  --display-name "Developico Timesheet" \
  --web-redirect-uris "https://yourdomain/api/auth/callback/azure-ad" \
  --sign-in-audience AzureADMyOrg
```

## 2. Client Secret

1. App Registration → Certificates & secrets → **New client secret**
2. Description: `timesheet-prod`
3. Expires: 24 months (recommended)
4. **Skopiuj wartość** — wyświetla się tylko raz!

→ `AZURE_AD_CLIENT_SECRET`

## 3. Uprawnienia API

### Microsoft Graph

App Registration → API permissions → **Add a permission** → Microsoft Graph → **Delegated permissions**:

| Permission | Typ | Opis |
|------------|-----|------|
| `User.Read` | Delegated | Odczyt profilu zalogowanego |
| `User.ReadBasic.All` | Delegated | Odczyt podstawowych profili |
| `GroupMember.Read.All` | Delegated | Odczyt członkostwa w grupach |
| `Group.Read.All` | Delegated | Odczyt informacji o grupach |

Po dodaniu → kliknij **Grant admin consent for [Tenant]**.

### Dataverse (opcjonalnie)

Jeśli używasz osobnej rejestracji dla Dataverse z client credentials:

App Registration → API permissions → **Add a permission** → Dynamics CRM → **Delegated permissions**:

| Permission | Typ |
|------------|-----|
| `user_impersonation` | Delegated |

## 4. Token Configuration

App Registration → Token configuration → **Add groups claim**:

1. Zaznacz: **Security groups**
2. W sekcji "Customize token properties by type":
   - **ID** → zaznacz (wymagane)
   - **Access** → zaznacz (opcjonalnie)
   - **SAML** → pomiń
3. Kliknij **Add**

> To umożliwia mapowanie ról z grup Entra ID w callback NextAuth.js.

## 5. Grupy bezpieczeństwa

### Tworzenie grup

Azure Portal → Microsoft Entra ID → Groups → **New group**:

| Parametr | Grupa Admin | Grupa Consultant |
|----------|-------------|-----------------|
| Group type | Security | Security |
| Group name | `TT-Administrators` | `TT-Consultants` |
| Group description | Administratorzy Timesheet | Konsultanci Timesheet |
| Membership type | Assigned | Assigned |

### Dodawanie członków

W każdej grupie → Members → **Add members** → wybierz użytkowników.

### Object ID

Skopiuj **Object ID** każdej grupy:

- `TT-Administrators` Object ID → `ADMIN_GROUP_ID`
- `TT-Consultants` Object ID → `CONSULTANT_GROUP_ID`

## 6. Opcjonalnie: Custom Scope

Jeśli chcesz wymusić scope dla tokenów:

1. App Registration → Expose an API
2. Application ID URI: `api://CLIENT_ID`
3. Add a scope:
   - Scope name: `access_as_user`
   - Who can consent: Admins and users
   - Admin consent display name: `Access Timesheet`
4. Skopiuj full scope URI: `api://CLIENT_ID/access_as_user`

→ `AZURE_AD_APP_SCOPE`

## 7. Redirect URIs

Upewnij się, że masz poprawne redirect URIs dla wszystkich środowisk:

| Środowisko | Redirect URI |
|------------|-------------|
| Lokalne | `http://localhost:3000/api/auth/callback/azure-ad` |
| Staging | `https://staging.yourdomain/api/auth/callback/azure-ad` |
| Produkcja | `https://yourdomain/api/auth/callback/azure-ad` |

## 8. Podsumowanie zmiennych

Po zakończeniu konfiguracji masz następujące wartości:

```env
# Z App Registration → Overview
AZURE_AD_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_AD_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Z App Registration → Certificates & secrets
AZURE_AD_CLIENT_SECRET=your-secret-value

# Z Groups → Object ID
ADMIN_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CONSULTANT_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Z Expose an API (opcjonalnie)
AZURE_AD_APP_SCOPE=api://CLIENT_ID/access_as_user

# Z konfiguracji NextAuth
NEXTAUTH_SECRET=random-32-char-string
NEXTAUTH_URL=https://yourdomain
```

## Weryfikacja

Po konfiguracji sprawdź:

1. Zaloguj się do aplikacji → powinien nastąpić redirect do Azure login
2. Po zalogowaniu sprawdź `GET /api/me` → powinna być poprawna rola
3. Sprawdź Console → nie powinno być błędów auth
4. Sprawdź token w DevTools → Application → Cookies → poprawny JWT
