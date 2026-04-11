# Konfiguracja zasobów Azure

## Przegląd

Aplikacja Developico Timesheet wymaga następujących zasobów Azure:

```
┌─────────────────────────────────────────────┐
│             Resource Group                   │
│  rg-developico-timesheet                    │
│                                              │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │ App Service   │  │ App Service Plan     │ │
│  │ (Linux,       │  │ (B1 / S1 / P1v3)    │ │
│  │  Node 20)     │  └──────────────────────┘ │
│  └──────┬───────┘                            │
│         │                                    │
│  ┌──────┴───────┐  ┌──────────────────────┐ │
│  │ Entra ID      │  │ Application Insights │ │
│  │ App           │  │ (opcjonalnie)        │ │
│  │ Registration  │  └──────────────────────┘ │
│  └──────────────┘                            │
└─────────────────────────────────────────────┘
                    │
       ┌────────────┼────────────┐
       │            │            │
  Entra ID    Dataverse    Graph API
 (tenant)     (CRM)       (users)
```

## 1. Resource Group

```bash
az group create \
  --name rg-developico-timesheet \
  --location westeurope
```

## 2. App Service Plan

```bash
az appservice plan create \
  --name plan-developico-timesheet \
  --resource-group rg-developico-timesheet \
  --sku B1 \
  --is-linux
```

| Plan | Rekomendacja |
|------|-------------|
| **B1** | Development / testy |
| **S1** | Produkcja (mała firma, <50 użytkowników) |
| **P1v3** | Produkcja (szybkość, autoscaling) |

## 3. App Service

```bash
az webapp create \
  --name developico-timesheet \
  --resource-group rg-developico-timesheet \
  --plan plan-developico-timesheet \
  --runtime "NODE:20-lts"

# Ustawienia
az webapp config set \
  --name developico-timesheet \
  --resource-group rg-developico-timesheet \
  --startup-file "node server.js" \
  --always-on true \
  --min-tls-version 1.2 \
  --https-only true
```

## 4. Zmienne środowiskowe

```bash
az webapp config appsettings set \
  --name developico-timesheet \
  --resource-group rg-developico-timesheet \
  --settings \
    NODE_ENV=production \
    AZURE_AD_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
    AZURE_AD_CLIENT_SECRET=your-secret \
    AZURE_AD_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
    NEXTAUTH_SECRET=your-random-secret \
    NEXTAUTH_URL=https://developico-timesheet.azurewebsites.net \
    ADMIN_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
    CONSULTANT_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
    NEXT_PUBLIC_USE_MOCK=false \
    DATAVERSE_ENABLED=true \
    DATAVERSE_URL=https://yourorg.crm4.dynamics.com \
    DATAVERSE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
    DATAVERSE_CLIENT_SECRET=your-dataverse-secret
```

## 5. Application Insights (opcjonalnie)

```bash
# Utwórz workspace
az monitor log-analytics workspace create \
  --resource-group rg-developico-timesheet \
  --workspace-name law-developico-timesheet

# Utwórz Application Insights
az monitor app-insights component create \
  --app ai-developico-timesheet \
  --location westeurope \
  --resource-group rg-developico-timesheet \
  --workspace law-developico-timesheet

# Pobierz connection string
az monitor app-insights component show \
  --app ai-developico-timesheet \
  --resource-group rg-developico-timesheet \
  --query connectionString -o tsv
```

Dodaj connection string do zmiennych App Service.

## 6. Custom Domain (opcjonalnie)

```bash
# Dodaj custom domain
az webapp config hostname add \
  --webapp-name developico-timesheet \
  --resource-group rg-developico-timesheet \
  --hostname timesheet.developico.com

# Utwórz managed certificate
az webapp config ssl create \
  --name developico-timesheet \
  --resource-group rg-developico-timesheet \
  --hostname timesheet.developico.com

# Bind SSL
az webapp config ssl bind \
  --name developico-timesheet \
  --resource-group rg-developico-timesheet \
  --certificate-thumbprint <THUMBPRINT> \
  --ssl-type SNI
```

Pamiętaj o aktualizacji:
- `NEXTAUTH_URL` → `https://timesheet.developico.com`
- Redirect URI w Entra ID App Registration

## Koszty szacunkowe

| Zasób | Plan | Koszt orientacyjny/mies. |
|-------|------|--------------------------|
| App Service Plan | B1 | ~$13 |
| App Service Plan | S1 | ~$70 |
| Application Insights | Free tier (5GB/mies.) | $0 |
| Custom Domain | — | $0 (certyfikat managed) |
| **Razem (B1)** | — | **~$13/mies.** |
| **Razem (S1)** | — | **~$70/mies.** |

> Dataverse i Entra ID nie są uwzględnione — rozliczane jako część licencji Microsoft 365 / Dynamics 365.
