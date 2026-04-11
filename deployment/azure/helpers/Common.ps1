<#
.SYNOPSIS
    Common helper functions for Developico Timesheet deployment scripts.

.DESCRIPTION
    Shared utilities used by Install-Timesheet.ps1, Setup-EntraId.ps1 and
    provisioning scripts. Source-dot this file at the top of each script:
        . "$PSScriptRoot\helpers\Common.ps1"
#>

function Write-StepHeader {
    param([string]$Step, [string]$Message)
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  [$Step] $Message" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
}

function Write-StepDetail {
    param([string]$Label, [string]$Value)
    Write-Host "  $Label : " -ForegroundColor DarkGray -NoNewline
    Write-Host $Value -ForegroundColor White
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "  ⚠ $Message" -ForegroundColor Yellow
}

function Write-Failure {
    param([string]$Message)
    Write-Host "  ✗ $Message" -ForegroundColor Red
}

function Test-AzureLogin {
    <#
    .SYNOPSIS
        Checks if the user is logged in to Azure CLI.
    .OUTPUTS
        Account object or $null if not logged in.
    #>
    try {
        $account = az account show 2>$null | ConvertFrom-Json
        if ($account) {
            return $account
        }
    }
    catch { }
    return $null
}

function Assert-AzureLogin {
    <#
    .SYNOPSIS
        Ensures Azure CLI login. Exits with error if not logged in.
    #>
    $account = Test-AzureLogin
    if (-not $account) {
        Write-Failure "Not logged in to Azure CLI. Run 'az login' first."
        exit 1
    }
    Write-StepDetail "Subscription" $account.name
    Write-StepDetail "Tenant" $account.tenantId
    return $account
}

function Get-RandomSuffix {
    param([int]$Length = 6)
    $chars = "abcdefghijklmnopqrstuvwxyz0123456789"
    $suffix = ""
    for ($i = 0; $i -lt $Length; $i++) {
        $suffix += $chars[(Get-Random -Maximum $chars.Length)]
    }
    return $suffix
}

function Wait-ForResource {
    <#
    .SYNOPSIS
        Polls until a resource is ready or timeout is reached.
    .PARAMETER ScriptBlock
        Script block that returns $true when resource is ready.
    .PARAMETER TimeoutSeconds
        Maximum wait time (default: 120).
    .PARAMETER IntervalSeconds
        Polling interval (default: 5).
    #>
    param(
        [scriptblock]$ScriptBlock,
        [int]$TimeoutSeconds = 120,
        [int]$IntervalSeconds = 5,
        [string]$ResourceName = "resource"
    )
    $elapsed = 0
    while ($elapsed -lt $TimeoutSeconds) {
        if (& $ScriptBlock) {
            Write-Success "$ResourceName is ready"
            return $true
        }
        Write-Host "  Waiting for $ResourceName... ($elapsed/$TimeoutSeconds s)" -ForegroundColor DarkGray
        Start-Sleep -Seconds $IntervalSeconds
        $elapsed += $IntervalSeconds
    }
    Write-Failure "$ResourceName not ready after $TimeoutSeconds seconds"
    return $false
}

function Test-CommandExists {
    param([string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}
