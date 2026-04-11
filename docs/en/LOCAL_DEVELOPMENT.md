# Local Development

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Mock Mode (default)](#mock-mode-default)
- [Connecting Dataverse](#connecting-dataverse)
- [Connecting Azure AD](#connecting-azure-ad)
- [Useful Commands](#useful-commands)
- [Troubleshooting](#troubleshooting)

## Requirements

| Tool | Version | Installation |
|------|---------|-------------|
| Node.js | 20.x or 22.x | [nodejs.org](https://nodejs.org/) |
| pnpm | 10+ | `corepack enable && corepack prepare pnpm@latest --activate` |
| Git | 2.x+ | [git-scm.com](https://git-scm.com/) |

## Installation

```bash
# Clone the repository
git clone https://github.com/Developico/developico-timesheet.git
cd developico-timesheet

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env.local

# Start the development server
pnpm dev
```

The application is available at http://localhost:3000.

## Mock Mode (default)

By default, the application runs with mock data (`NEXT_PUBLIC_USE_MOCK=true` in `.env.example`). This mode:

- Requires no external services
- Provides sample data (consultants, projects, time entries)
- Allows full UI and logic testing
- Does not require authentication

### Demo data

```bash
# Load demo data (Dataverse)
pnpm seed:demo

# Dry run (preview without saving)
pnpm seed:demo:dry

# Remove demo data
pnpm seed:cleanup
```

## Connecting Dataverse

To connect a real Dataverse backend:

### 1. Register an app in Entra ID

1. Azure Portal → Entra ID → App registrations → New registration
2. Name: `developico-timesheet-api`
3. API permissions: Dynamics CRM → `user_impersonation`
4. Generate a client secret

### 2. Configure `.env.local`

```env
NEXT_PUBLIC_USE_MOCK=false
DATAVERSE_ENABLED=true
DATAVERSE_URL=https://yourorg.crm4.dynamics.com
DATAVERSE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DATAVERSE_CLIENT_SECRET=your-secret
```

### 3. Verify

Start the application and check the endpoint:

```
GET http://localhost:3000/api/health
```

Should return `"dataSource": "dataverse"`.

## Connecting Azure AD

For full authentication:

### 1. Register the application

1. Azure Portal → Entra ID → App registrations → New registration
2. Redirect URIs: `http://localhost:3000/api/auth/callback/azure-ad`
3. Graph API permissions: `User.Read`, `User.ReadBasic.All`, `GroupMember.Read.All`, `Group.Read.All`
4. Optionally: Custom scope `api://APP_ID/access_as_user`

### 2. Security groups

Create in Entra ID:
- **Administrators** group → copy Object ID
- **Consultants** group → copy Object ID

### 3. Token Configuration

In App Registration → Token configuration → Add groups claim:
- Check: Security groups
- Token type: ID

### 4. Configure `.env.local`

```env
AZURE_AD_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_AD_CLIENT_SECRET=your-secret
AZURE_AD_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXTAUTH_SECRET=random-string-at-least-32-chars
ADMIN_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CONSULTANT_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Useful Commands

```bash
# Development server
pnpm dev

# Development server with Turbopack (faster hot reload)
pnpm dev-turbo

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Unit tests
pnpm test

# Tests in watch mode
pnpm test:watch

# E2E tests (requires running server)
pnpm test:e2e

# Production build
pnpm build

# Run production build
pnpm start
```

## Troubleshooting

### Port 3000 in use

```bash
# Windows
npx kill-port 3000
# or
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### `AZURE_AD_CLIENT_ID is required` error

In development mode this warning is non-fatal. The app works with mock data. In production, set all required variables.

### `pnpm install` fails

Make sure corepack is enabled:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### No data after switching to Dataverse

1. Check `GET /api/health` — is `dataSource` set to `dataverse`?
2. Check console logs — look for `[dataverse]`
3. Make sure `DATAVERSE_ENABLED=true` and URL is correct
4. Check app permissions in Dataverse (Security Role)

Full troubleshooting guide: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
