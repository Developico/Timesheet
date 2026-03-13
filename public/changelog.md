# Developico Time Tracker — Changelog

## v1.5.0 — 2026-03-13

### 🆕 Added — Reports: Task Details & Grouped View
- **Include Tasks** toggle — expands report rows to show individual time entries (task, date, consultant, hours, billable)
- **Group by Task** toggle — aggregates task entries by name with totals (hours, billable/non-billable, entry count)
- Expand All / Collapse All buttons for task sub-rows
- Searchable combobox for Project and Consultant dropdowns (sorted alphabetically, powered by cmdk + Radix Popover)
- CSV export supports both individual and grouped task modes
- PDF export supports both individual and grouped task modes

### 🧪 Testing
- 8 new tests: `groupTaskDetails` utility (3), report engine `includeTasks` (3), CSV export with task details (1), CSV grouped export (1)
- All 81 tests passing

---

## v1.4.0 — 2026-03-06

### 🆕 Added — Reports Module (admin-only)
- New **Reports** tab in navigation (visible only to Administrators)
- Report Builder with custom filters: date range, group by (consultant/project/client), billable filter, project & consultant selectors
- 4 quick report presets: Weekly by Consultant, Monthly by Project, Team Utilization, Billing Summary
- Animated horizontal bar chart showing hours distribution with billable/non-billable gradient
- Summary cards with color accents (total hours, billable hours, billable %, projects, consultants)
- CSV export with UTF-8 BOM (Excel-compatible Polish characters)
- PDF export via printable HTML (no heavy dependencies)
- Server-side auth guard: API returns 403 for non-admin users
- Zod validation on all report query parameters

### 🧪 Testing
- 19 new tests: report engine aggregation (10) + CSV/filename export (9)
- All 73 tests passing

---

## v1.3.0 — 2026-03-06

### 🔒 Security
- Added HTTP security headers middleware (CSP, HSTS, X-Frame-Options)
- Unified API auth guard with consistent 401 responses
- Rate limiting — sliding window 600 req/min (API), 30 req/min (auth)
- OData injection sanitizer for all Dataverse queries
- Server-only environment variable validation (Zod schema)

### 🧪 Testing
- Vitest setup with 54 unit & integration tests
- API route integration tests (auth 401, validation 400, success 200, error 500)
- Playwright E2E tests — 7 smoke tests covering login, navigation, tabs & theme

### ♻️ Refactoring
- Broke `dataverse.ts` (500+ lines) into 4 focused modules
- Consolidated 3 loggers into single unified `lib/logger.ts`
- Standardised API responses (`apiError` / `apiSuccess` helpers)
- Extracted magic numbers into `lib/constants.ts`
- Removed 34 unused dependencies, pinned all versions

### ⚡ Improved
- Enabled Next.js image optimisation (AVIF + WebP, responsive sizes)
- Enabled React Strict Mode
- Renamed project to `developico-timesheet`
- Changelog now rendered as formatted Markdown

---

## v1.2.5 — 2025-09-26

### 🔧 Fixed
- User profile photos now display correctly in project team panels
- Improved avatar loading from Microsoft Graph API

---

## v1.2.4 — 2024-09-24

### 🥚 Added
- Triple-click easter egg on app title to reveal changelog
- Animated changelog modal with slide-down effect
- Version information system with centralised configuration
- Interactive changelog viewer with loading states and responsive design

### ⚡ Changed
- App header now has interactive title with hover effects
- Enhanced user experience with hidden feature discovery

---

## v1.2.3 — 2024-09-24

### 🆕 Added
- Mobile responsive summary cards with 2×2 grid layout
- Mobile filter drawer with complete project synchronisation
- Ultra-stable panel state management system

### 🔧 Fixed
- Panel closing issues on window focus/blur events
- Mobile UI overflow in summary metrics cards
- Text overlapping on small screen devices

### ⚡ Changed
- Improved mobile layout for projects and calendar pages
- Enhanced panel state persistence across browser sessions
- Optimised responsive breakpoints for better mobile experience

---

## v1.2.2 — 2024-09-20

### 🔧 Fixed
- Time entry validation edge cases
- Dashboard loading performance issues

---

## v1.2.1 — 2024-09-18

### 🆕 Added
- Dark mode theme support
- Export functionality for time reports

### 🔧 Fixed
- Calendar navigation bugs
- Project filtering inconsistencies

---

## v1.2.0 — 2024-09-15

### 🆕 Added
- New project management interface
- Advanced filtering capabilities
- Real-time collaboration features

### ⚡ Changed
- Redesigned user interface
- Improved performance across all pages
- Enhanced accessibility compliance

---

## v1.1.0 — 2024-09-01

### 🆕 Added
- Calendar view for time entries
- Project analytics dashboard
- User preferences settings

---

## v1.0.0 — 2024-08-15

### 🎉 Initial Release
- Core time tracking functionality
- Project and task management
- Basic reporting features
- User authentication system

---

> 💡 **Tip:** Keep clicking around — there might be more easter eggs hidden! 🐰
