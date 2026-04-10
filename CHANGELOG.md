# Changelog

## [Unreleased]

### Fixed

- **Reports: dates synced with global period selector** — Report Date From / Date To
  fields now initialize from the navigation bar period picker (e.g. "This Quarter") and
  update automatically when the global period changes. Manual date edits still work
  independently. (`components/reports/report-builder.tsx`)

- **Reports: consultant list shows only real people** — The consultant dropdown now
  fetches from the Graph API (`/api/graph/consultants`) — the same source as the
  consultant context switcher — instead of Dataverse `systemusers`, which included
  service accounts like `CDSReportService-*`. Falls back to Dataverse (active-only
  filter) if Graph is unavailable. (`components/reports/report-builder.tsx`, `app/page.tsx`)

- **Reports: filter state persisted across tab switches** — All report filter values
  (dates, group by, billable, project, consultant, include tasks) are saved to
  `sessionStorage` and restored when navigating back to the Reports tab.
  (`components/reports/report-builder.tsx`)
