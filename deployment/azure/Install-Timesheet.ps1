<#
.SYNOPSIS
    Master installer for Developico Timesheet on Azure.

.DESCRIPTION
    Deploys the complete Timesheet infrastructure and application:
      1. Verifies prerequisites (az CLI, Node.js, pnpm)
      2. Creates Resource Group
      3. Deploys Azure resources (App Service Plan + App Service)
      4. Configures App Service settings
      5. Builds the application (Next.js standalone)
      6. Deploys to Azure App Service

    For Entra ID setup, run Setup-EntraId.ps1 first.

.PARAMETER Environment
    Target environment: dev, test, or prod. Default: dev.

.PARAMETER ResourceGroupName
    Azure Resource Group name. Default: rg-developico-timesheet-{env}.

.PARAMETER Location
    Azure region. Default: westeurope.

.PARAMETER AppServicePlan
    App Service Plan SKU. Default: B1 for dev/test, S1 for prod.

.PARAMETER SkipBuild
    Skip the pnpm build step (deploy existing build).

.PARAMETER UpdateOnly
    Skip infrastructure provisioning, only build and deploy the app.

.EXAMPLE
    # Full install (dev)
    .\Install-Timesheet.ps1

    # Production with custom resource group
    .\Install-Timesheet.ps1 -Environment prod -ResourceGroupName rg-timesheet-prod

    # Redeploy only (no infra changes)
    .\Install-Timesheet.ps1 -UpdateOnly
#>

[CmdletBinding()]
param(
    [ValidateSet("dev", "test", "prod")]
    [string]$Environment = "dev",

    [string]$ResourceGroupName = "",
    [string]$Location = "westeurope",
    [string]$AppServicePlan = "",
    [switch]$SkipBuild,
    [switch]$UpdateOnly
)

$ErrorActionPreference = "Stop"

# Import helpers
. "$PSScriptRoot\helpers\Common.ps1"

# ── Configuration ────────────────────────────────────────────────────────────
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot ".." "..")

if (-not $ResourceGroupName) {
    $ResourceGroupName = "rg-developico-timesheet-$Environment"
}

if (-not $AppServicePlan) {
    $AppServicePlan = if ($Environment -eq "prod") { "S1" } else { "B1" }
}

$config = @{
    ResourceGroup    = $ResourceGroupName
    Location         = $Location
    PlanName         = "plan-tt-$Environment"
    PlanSku          = $AppServicePlan
    AppName          = "developico-timesheet-$Environment"
    NodeVersion      = "20-lts"
    Environment      = $Environment
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Developico Timesheet — Azure Installer          ║" -ForegroundColor Cyan
Write-Host "║  Environment: $($Environment.PadRight(37))║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ── Step 1: Prerequisites ────────────────────────────────────────────────────
Write-StepHeader "1/6" "Checking prerequisites"

# Azure CLI
$account = Assert-AzureLogin

# Node.js
if (-not (Test-CommandExists "node")) {
    Write-Failure "Node.js not found. Install from https://nodejs.org/"
    exit 1
}
$nodeVersion = (node --version)
Write-StepDetail "Node.js" $nodeVersion

# pnpm
if (-not (Test-CommandExists "pnpm")) {
    Write-Failure "pnpm not found. Run: corepack enable && corepack prepare pnpm@latest --activate"
    exit 1
}
Write-StepDetail "pnpm" (pnpm --version)

Write-StepDetail "Project root" $projectRoot
Write-StepDetail "Resource Group" $config.ResourceGroup
Write-StepDetail "App Service" $config.AppName
Write-StepDetail "Plan" "$($config.PlanName) ($($config.PlanSku))"
Write-StepDetail "Region" $config.Location

# ── Step 2: Resource Group ───────────────────────────────────────────────────
if (-not $UpdateOnly) {
    Write-StepHeader "2/6" "Creating Resource Group"

    $rgExists = az group exists --name $config.ResourceGroup 2>$null
    if ($rgExists -eq "true") {
        Write-Warning "Resource Group '$($config.ResourceGroup)' already exists"
    }
    else {
        az group create --name $config.ResourceGroup --location $config.Location --output none
        Write-Success "Created Resource Group: $($config.ResourceGroup)"
    }

    # ── Step 3: App Service Plan ─────────────────────────────────────────────
    Write-StepHeader "3/6" "Creating App Service Plan"

    $planExists = az appservice plan show --name $config.PlanName --resource-group $config.ResourceGroup 2>$null
    if ($planExists) {
        Write-Warning "Plan '$($config.PlanName)' already exists"
    }
    else {
        az appservice plan create `
            --name $config.PlanName `
            --resource-group $config.ResourceGroup `
            --sku $config.PlanSku `
            --is-linux `
            --output none
        Write-Success "Created plan: $($config.PlanName) ($($config.PlanSku))"
    }

    # ── Step 4: App Service ──────────────────────────────────────────────────
    Write-StepHeader "4/6" "Creating App Service"

    $appExists = az webapp show --name $config.AppName --resource-group $config.ResourceGroup 2>$null
    if ($appExists) {
        Write-Warning "App Service '$($config.AppName)' already exists"
    }
    else {
        az webapp create `
            --name $config.AppName `
            --resource-group $config.ResourceGroup `
            --plan $config.PlanName `
            --runtime "NODE:$($config.NodeVersion)" `
            --output none
        Write-Success "Created App Service: $($config.AppName)"
    }

    # Configure App Service
    az webapp config set `
        --name $config.AppName `
        --resource-group $config.ResourceGroup `
        --startup-file "node server.js" `
        --always-on true `
        --min-tls-version 1.2 `
        --https-only true `
        --output none
    Write-Success "Configured App Service (startup, TLS, HTTPS)"

    # Set NODE_ENV
    az webapp config appsettings set `
        --name $config.AppName `
        --resource-group $config.ResourceGroup `
        --settings NODE_ENV=production `
        --output none 2>$null
    Write-Success "Set NODE_ENV=production"
}
else {
    Write-StepHeader "2/6" "Skipping infrastructure (UpdateOnly mode)"
    Write-StepHeader "3/6" "Skipping plan (UpdateOnly mode)"
    Write-StepHeader "4/6" "Skipping app (UpdateOnly mode)"
}

# ── Step 5: Build ────────────────────────────────────────────────────────────
Write-StepHeader "5/6" "Building application"

Push-Location $projectRoot
try {
    if (-not $SkipBuild) {
        Write-Host "  Installing dependencies..." -ForegroundColor DarkGray
        pnpm install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }

        Write-Host "  Type checking..." -ForegroundColor DarkGray
        pnpm typecheck
        if ($LASTEXITCODE -ne 0) { throw "Typecheck failed" }

        Write-Host "  Running tests..." -ForegroundColor DarkGray
        pnpm test
        if ($LASTEXITCODE -ne 0) { throw "Tests failed" }

        Write-Host "  Building Next.js (standalone)..." -ForegroundColor DarkGray
        pnpm build
        if ($LASTEXITCODE -ne 0) { throw "Build failed" }
        Write-Success "Build completed"
    }
    else {
        Write-Warning "Skipping build (SkipBuild flag)"
    }

    # ── Step 6: Deploy ───────────────────────────────────────────────────────
    Write-StepHeader "6/6" "Deploying to Azure"

    # Prepare standalone artifact
    $standalonePath = Join-Path $projectRoot ".next" "standalone"
    $staticSrc = Join-Path $projectRoot ".next" "static"
    $staticDest = Join-Path $standalonePath ".next" "static"
    $publicSrc = Join-Path $projectRoot "public"
    $publicDest = Join-Path $standalonePath "public"

    if (Test-Path $staticSrc) {
        Copy-Item -Path $staticSrc -Destination $staticDest -Recurse -Force
        Write-StepDetail "Copied" ".next/static → standalone"
    }
    if (Test-Path $publicSrc) {
        Copy-Item -Path $publicSrc -Destination $publicDest -Recurse -Force
        Write-StepDetail "Copied" "public/ → standalone"
    }

    # Zip deploy
    $zipPath = Join-Path $projectRoot "deploy-artifact.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath }

    Write-Host "  Creating deployment package..." -ForegroundColor DarkGray
    Compress-Archive -Path "$standalonePath\*" -DestinationPath $zipPath -Force

    $retries = 3
    for ($i = 1; $i -le $retries; $i++) {
        Write-Host "  Deploying (attempt $i/$retries)..." -ForegroundColor DarkGray
        az webapp deployment source config-zip `
            --name $config.AppName `
            --resource-group $config.ResourceGroup `
            --src $zipPath `
            --output none 2>$null

        if ($LASTEXITCODE -eq 0) {
            Write-Success "Deployment successful!"
            break
        }

        if ($i -eq $retries) {
            Write-Failure "Deployment failed after $retries attempts"
            exit 1
        }
        Write-Warning "Attempt $i failed, retrying..."
        Start-Sleep -Seconds 10
    }

    # Cleanup
    Remove-Item $zipPath -ErrorAction SilentlyContinue

    # Smoke test
    $appUrl = "https://$($config.AppName).azurewebsites.net/api/health"
    Write-Host "  Smoke test: $appUrl" -ForegroundColor DarkGray
    Start-Sleep -Seconds 5

    try {
        $response = Invoke-RestMethod -Uri $appUrl -TimeoutSec 30 -ErrorAction Stop
        if ($response.status -eq "ok") {
            Write-Success "Health check passed: status=$($response.status), dataSource=$($response.dataSource)"
        }
        else {
            Write-Warning "Health check returned unexpected status: $($response.status)"
        }
    }
    catch {
        Write-Warning "Health check failed (app may still be starting): $($_.Exception.Message)"
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Deployment complete!                            ║" -ForegroundColor Green
Write-Host "║  URL: https://$($config.AppName.PadRight(28))   ║" -ForegroundColor Green
Write-Host "║       .azurewebsites.net                         ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
