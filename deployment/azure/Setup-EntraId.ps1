<#
.SYNOPSIS
    Configures Microsoft Entra ID App Registration for Developico Timesheet.

.DESCRIPTION
    Creates or updates an App Registration with:
    - Redirect URIs for NextAuth.js
    - Microsoft Graph delegated permissions (User.Read, GroupMember.Read.All, etc.)
    - Client secret generation
    - Security groups for RBAC (optional)
    - Token configuration for groups claim

    Requires: Azure CLI (az) logged in with sufficient permissions.

.PARAMETER AppName
    Display name for the App Registration. Default: "Developico Timesheet".

.PARAMETER RedirectUri
    OAuth2 callback URI. Default: "http://localhost:3000/api/auth/callback/azure-ad".

.PARAMETER SecretValidityMonths
    Client secret validity in months. Default: 24.

.PARAMETER CreateGroups
    If set, creates TT-Administrators and TT-Consultants security groups.

.PARAMETER OutputEnvFile
    If set, writes resulting configuration to .env.local.

.EXAMPLE
    .\Setup-EntraId.ps1 -RedirectUri "https://timesheet.developico.com/api/auth/callback/azure-ad" -CreateGroups
#>

[CmdletBinding()]
param(
    [string]$AppName = "Developico Timesheet",
    [string]$RedirectUri = "http://localhost:3000/api/auth/callback/azure-ad",
    [int]$SecretValidityMonths = 24,
    [switch]$CreateGroups,
    [switch]$OutputEnvFile
)

$ErrorActionPreference = "Stop"

# Import helpers
. "$PSScriptRoot\helpers\Common.ps1"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Developico Timesheet — Entra ID Setup           ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ── Step 1: Verify Azure CLI login ──────────────────────────────────────────
Write-StepHeader "1/6" "Checking Azure CLI login"
$account = Assert-AzureLogin
$tenantId = $account.tenantId

# ── Step 2: Create or find App Registration ─────────────────────────────────
Write-StepHeader "2/6" "App Registration: $AppName"

$existingApp = az ad app list --display-name $AppName --query "[0]" 2>$null | ConvertFrom-Json
if ($existingApp) {
    Write-Warning "App Registration '$AppName' already exists (ID: $($existingApp.appId))"
    $appId = $existingApp.appId
    $objectId = $existingApp.id
}
else {
    Write-Host "  Creating App Registration..." -ForegroundColor DarkGray
    $appJson = az ad app create `
        --display-name $AppName `
        --sign-in-audience AzureADMyOrg `
        --web-redirect-uris $RedirectUri `
        --enable-id-token-issuance true | ConvertFrom-Json

    $appId = $appJson.appId
    $objectId = $appJson.id
    Write-Success "Created App Registration: $appId"
}

Write-StepDetail "App (client) ID" $appId
Write-StepDetail "Object ID" $objectId
Write-StepDetail "Tenant ID" $tenantId

# ── Step 3: Client Secret ───────────────────────────────────────────────────
Write-StepHeader "3/6" "Generating client secret"

$endDate = (Get-Date).AddMonths($SecretValidityMonths).ToString("yyyy-MM-ddTHH:mm:ssZ")
$secretJson = az ad app credential reset `
    --id $objectId `
    --display-name "timesheet-deploy-$((Get-Date).ToString('yyyyMMdd'))" `
    --end-date $endDate `
    --query "{clientId: appId, clientSecret: password, tenantId: tenant}" | ConvertFrom-Json

$clientSecret = $secretJson.clientSecret
Write-Success "Secret created (expires: $endDate)"
Write-Warning "Save this secret — it will not be shown again!"

# ── Step 4: Graph API Permissions ───────────────────────────────────────────
Write-StepHeader "4/6" "Configuring Microsoft Graph permissions"

# Microsoft Graph App ID
$graphAppId = "00000003-0000-0000-c000-000000000000"

# Permission IDs (delegated)
$permissions = @{
    "User.Read"            = "e1fe6dd8-ba31-4d61-89e7-88639da4683d"
    "User.ReadBasic.All"   = "b340eb25-3456-403f-be2f-af7a0d370277"
    "GroupMember.Read.All"  = "bc024368-1153-4739-b217-4326f2e966d0"
    "Group.Read.All"       = "5f8c59db-677d-491f-a6b8-5f174b11ec1d"
}

foreach ($perm in $permissions.GetEnumerator()) {
    Write-Host "  Adding $($perm.Key)..." -ForegroundColor DarkGray
    az ad app permission add `
        --id $objectId `
        --api $graphAppId `
        --api-permissions "$($perm.Value)=Scope" 2>$null
}

Write-Success "Graph permissions configured"
Write-Host "  ⚠ Remember to grant admin consent in Azure Portal" -ForegroundColor Yellow

# ── Step 5: Security Groups (optional) ──────────────────────────────────────
$adminGroupId = ""
$consultantGroupId = ""

if ($CreateGroups) {
    Write-StepHeader "5/6" "Creating security groups"

    # Administrators
    $existingAdmin = az ad group list --display-name "TT-Administrators" --query "[0].id" -o tsv 2>$null
    if ($existingAdmin) {
        $adminGroupId = $existingAdmin
        Write-Warning "TT-Administrators already exists: $adminGroupId"
    }
    else {
        $adminGroupId = az ad group create `
            --display-name "TT-Administrators" `
            --mail-nickname "tt-administrators" `
            --description "Developico Timesheet — Administrators" `
            --query "id" -o tsv
        Write-Success "Created TT-Administrators: $adminGroupId"
    }

    # Consultants
    $existingConsultant = az ad group list --display-name "TT-Consultants" --query "[0].id" -o tsv 2>$null
    if ($existingConsultant) {
        $consultantGroupId = $existingConsultant
        Write-Warning "TT-Consultants already exists: $consultantGroupId"
    }
    else {
        $consultantGroupId = az ad group create `
            --display-name "TT-Consultants" `
            --mail-nickname "tt-consultants" `
            --description "Developico Timesheet — Consultants" `
            --query "id" -o tsv
        Write-Success "Created TT-Consultants: $consultantGroupId"
    }

    Write-StepDetail "Admin Group ID" $adminGroupId
    Write-StepDetail "Consultant Group ID" $consultantGroupId
}
else {
    Write-StepHeader "5/6" "Skipping group creation (use -CreateGroups to create)"
}

# ── Step 6: Output ──────────────────────────────────────────────────────────
Write-StepHeader "6/6" "Summary"

$envContent = @"
# Generated by Setup-EntraId.ps1 on $(Get-Date -Format 'yyyy-MM-dd HH:mm')
# Tenant: $($account.name)

AZURE_AD_CLIENT_ID=$appId
AZURE_AD_CLIENT_SECRET=$clientSecret
AZURE_AD_TENANT_ID=$tenantId
NEXTAUTH_SECRET=$(([guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()).Replace('-','').Substring(0,48))
NEXTAUTH_URL=http://localhost:3000
"@

if ($adminGroupId) {
    $envContent += "`nADMIN_GROUP_ID=$adminGroupId"
}
if ($consultantGroupId) {
    $envContent += "`nCONSULTANT_GROUP_ID=$consultantGroupId"
}

Write-Host $envContent -ForegroundColor Gray

if ($OutputEnvFile) {
    $envPath = Join-Path (Split-Path $PSScriptRoot -Parent) ".." ".env.local"
    $envPath = [System.IO.Path]::GetFullPath($envPath)

    if (Test-Path $envPath) {
        $backup = "$envPath.bak"
        Copy-Item $envPath $backup
        Write-Warning "Existing .env.local backed up to .env.local.bak"
    }

    $envContent | Out-File -FilePath $envPath -Encoding utf8NoBOM
    Write-Success "Written to $envPath"
}

Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Cyan
Write-Host "    1. Grant admin consent: Azure Portal → App Registration → API permissions" -ForegroundColor White
Write-Host "    2. Add groups claim: App Registration → Token configuration → Add groups claim (Security groups, ID token)" -ForegroundColor White
Write-Host "    3. Add users to TT-Administrators / TT-Consultants groups" -ForegroundColor White
Write-Host "    4. Copy values above to .env.local (or use -OutputEnvFile)" -ForegroundColor White
Write-Host ""
