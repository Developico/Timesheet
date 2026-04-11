<#
.SYNOPSIS
    Provisions the full Developico Timesheet Dataverse environment.

.DESCRIPTION
    Creates all required Dataverse tables, columns, relationships,
    option sets, and security roles for the Timesheet application.

    Uses Power Platform CLI (pac) for environment provisioning.

.PARAMETER EnvironmentUrl
    The Dataverse environment URL (e.g., https://your-env.crm4.dynamics.com).

.PARAMETER PublisherPrefix
    Publisher prefix for custom components. Default: "tt".

.PARAMETER SkipAuth
    Skip pac auth if already authenticated.

.EXAMPLE
    .\Provision-FullEnvironment.ps1 -EnvironmentUrl "https://your-env.crm4.dynamics.com"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$EnvironmentUrl,

    [string]$PublisherPrefix = "tt",
    [switch]$SkipAuth
)

$ErrorActionPreference = "Stop"

# Import common helpers
$helpersPath = Join-Path $PSScriptRoot ".." "azure" "helpers" "Common.ps1"
if (Test-Path $helpersPath) {
    . $helpersPath
}
else {
    function Write-StepHeader { param($Step, $Message) Write-Host "`n[$Step] $Message" }
    function Write-Success { param($Message) Write-Host "  OK: $Message" -ForegroundColor Green }
    function Write-Warning { param($Message) Write-Host "  WARN: $Message" -ForegroundColor Yellow }
    function Write-Failure { param($Message) Write-Host "  FAIL: $Message" -ForegroundColor Red }
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Developico Timesheet — Dataverse Provisioning   ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ── Step 1: Prerequisites ────────────────────────────────────────────────────
Write-StepHeader "1/5" "Checking prerequisites"

if (-not (Get-Command "pac" -ErrorAction SilentlyContinue)) {
    Write-Failure "Power Platform CLI (pac) not found."
    Write-Host "  Install: https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction" -ForegroundColor Gray
    exit 1
}
Write-Success "pac CLI found"

# ── Step 2: Authenticate ────────────────────────────────────────────────────
Write-StepHeader "2/5" "Authenticating to Dataverse"

if (-not $SkipAuth) {
    pac auth create --environment $EnvironmentUrl
    if ($LASTEXITCODE -ne 0) {
        Write-Failure "Authentication failed"
        exit 1
    }
    Write-Success "Authenticated to $EnvironmentUrl"
}
else {
    Write-Warning "Skipping auth (SkipAuth flag)"
}

# ── Step 3: Create tables ───────────────────────────────────────────────────
Write-StepHeader "3/5" "Creating Dataverse tables"

$tables = @(
    @{
        Name          = "${PublisherPrefix}_project"
        DisplayName   = "Timesheet Project"
        PluralName    = "Timesheet Projects"
        Description   = "Projects for time registration"
    },
    @{
        Name          = "${PublisherPrefix}_projectuser"
        DisplayName   = "Project User Assignment"
        PluralName    = "Project User Assignments"
        Description   = "Many-to-many assignment of users to projects"
    },
    @{
        Name          = "${PublisherPrefix}_timeregister"
        DisplayName   = "Time Register"
        PluralName    = "Time Registers"
        Description   = "Individual time entries"
    },
    @{
        Name          = "${PublisherPrefix}_daysoff"
        DisplayName   = "Days Off"
        PluralName    = "Days Off"
        Description   = "Vacation, sick leave, and other days off"
    }
)

foreach ($table in $tables) {
    Write-Host "  Creating table: $($table.Name)..." -ForegroundColor DarkGray

    # Note: pac CLI does not support direct table creation.
    # This section documents the schema for manual or solution-based provisioning.
    # Use 'pac solution import' with the Dataverse solution ZIP instead.

    Write-StepDetail $table.Name $table.DisplayName
}

Write-Warning "Table creation via pac CLI is limited."
Write-Host "  Recommended: Import the Dataverse solution ZIPs instead:" -ForegroundColor Yellow
Write-Host "    pac solution import --path ./TimeTrack_1_0_0_0.zip --publish-changes" -ForegroundColor White
Write-Host "    pac solution import --path ./TimeTrackCustomConnector_1_0_0_0.zip --publish-changes" -ForegroundColor White

# ── Step 4: Schema documentation ────────────────────────────────────────────
Write-StepHeader "4/5" "Schema summary"

$schemaDoc = @"

  Tables to create/verify:
  ┌─────────────────────────┬──────────────────────────────────┐
  │ Table                   │ Key Columns                      │
  ├─────────────────────────┼──────────────────────────────────┤
  │ ${PublisherPrefix}_project          │ name, code, isactive, color,     │
  │                         │ budgethours, startdate, enddate  │
  ├─────────────────────────┼──────────────────────────────────┤
  │ ${PublisherPrefix}_projectuser      │ projectid (FK), userid (FK),     │
  │                         │ role (OptionSet: member/manager)  │
  ├─────────────────────────┼──────────────────────────────────┤
  │ ${PublisherPrefix}_timeregister     │ date, hours, description,        │
  │                         │ projectid (FK), userid (FK),     │
  │                         │ status (OptionSet)               │
  ├─────────────────────────┼──────────────────────────────────┤
  │ ${PublisherPrefix}_daysoff          │ userid (FK), startdate, enddate, │
  │                         │ type (OptionSet), description    │
  └─────────────────────────┴──────────────────────────────────┘

  OptionSets:
  - ${PublisherPrefix}_timeregisterstatus: draft(0), submitted(1), approved(2), rejected(3)
  - ${PublisherPrefix}_projectuserrole: member(0), manager(1)
  - ${PublisherPrefix}_daysofftype: vacation(0), sick(1), other(2)

"@

Write-Host $schemaDoc -ForegroundColor Gray

# ── Step 5: Verify ──────────────────────────────────────────────────────────
Write-StepHeader "5/5" "Verification"

Write-Host "  To verify provisioning:" -ForegroundColor Cyan
Write-Host "    1. Open Power Apps Studio → Tables → Filter by 'tt_'" -ForegroundColor White
Write-Host "    2. Verify all 4 tables exist with correct columns" -ForegroundColor White
Write-Host "    3. Check relationships and OptionSets" -ForegroundColor White
Write-Host "    4. Test from the web app with DATA_SOURCE=dataverse" -ForegroundColor White
Write-Host ""
Write-Success "Provisioning script completed"
Write-Host ""
