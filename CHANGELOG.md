# Changelog

## [Unreleased]

### Fixed

- **Reports: dates derived from global period selector** — Report Date From / Date To
  fields now directly derive from the navigation bar period picker (e.g. "This Quarter",
  "This Year"). Changing the global period immediately updates the report dates — no
  stale values. Manual date edits are still possible and override the global dates until
  the period is changed again. (`components/reports/report-builder.tsx`)

- **Reports: consultant list shows only real people** — The consultant dropdown now
  fetches from the Graph API (`/api/graph/consultants`) — the same source as the
  consultant context switcher — instead of Dataverse `systemusers`, which included
  service accounts like `CDSReportService-*`. Falls back to Dataverse (active-only
  filter) if Graph is unavailable. (`components/reports/report-builder.tsx`, `app/page.tsx`)

- **Reports: filter state persisted across tab switches** — All report filter values
  (dates, group by, billable, project, consultant, include tasks) are saved to
  `sessionStorage` and restored when navigating back to the Reports tab.
  (`components/reports/report-builder.tsx`)
