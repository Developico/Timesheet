# Raportowanie i eksport danych — Plan wdrożenia

> **Feature:** 2.3 z [FEATURE_PROPOSALS.md](FEATURE_PROPOSALS.md)  
> **Dostępność:** Wyłącznie rola `Administrator`  
> **Zależności:** Brak (wykorzystuje istniejące API endpoints do odczytu danych)

---

## Spis treści

1. [Architektura modułu](#1-architektura-modułu)
2. [Faza 1 — Strona raportów i kreator](#faza-1--strona-raportów-i-kreator)
3. [Faza 2 — Silnik danych raportowych](#faza-2--silnik-danych-raportowych)
4. [Faza 3 — Eksport CSV i XLSX](#faza-3--eksport-csv-i-xlsx)
5. [Faza 4 — Eksport PDF](#faza-4--eksport-pdf)
6. [Faza 5 — Predefiniowane raporty](#faza-5--predefiniowane-raporty)
7. [Testy](#testy)
8. [Pliki do utworzenia / modyfikacji](#pliki-do-utworzenia--modyfikacji)
9. [Zależności npm](#zależności-npm)

---

## 1. Architektura modułu

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer (client)                     │
│                                                         │
│  /reports page ──► ReportBuilder ──► ReportPreview      │
│       │               │                   │             │
│       │          ReportFilters        DataTable          │
│       │          DateRangePicker      Charts (Recharts)  │
│       │                                                 │
│       └────────► ExportBar ──► CSV / XLSX / PDF         │
└────────────────────┬────────────────────────────────────┘
                     │ fetch
┌────────────────────▼────────────────────────────────────┐
│                  API Layer (server)                      │
│                                                         │
│  /api/reports/data   ──► ReportEngine (agregacja,       │
│       │                   grupowanie, metryki)           │
│       │                                                 │
│  /api/reports/pdf    ──► PDF renderer (server-side)     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Auth guard: requireAuth + role === Administrator │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────┘
                     │ IDataSource
┌────────────────────▼────────────────────────────────────┐
│              Dataverse / Mock (istniejąca warstwa)       │
└─────────────────────────────────────────────────────────┘
```

### Kluczowe decyzje

| Decyzja | Wybór | Uzasadnienie |
|---|---|---|
| Autoryzacja | Server-side (API) + client-side (UI hide) | Podwójna ochrona — nawet direct API call wymaga roli admin |
| CSV/XLSX | Generowane client-side | Brak potrzeby obciążania serwera; dane już pobrane do renderowania preview |
| PDF | Generowany server-side | Wymaga renderowania komponentów React do statycznego HTML; puppeteer lub @react-pdf/renderer |
| Routing | Nowa zakładka w istniejącym tab system | Spójne z resztą app (dashboard/calendar/projects/reports) |
| State management | Local state w komponencie ReportBuilder | Filtry raportów nie muszą być globalne ani persystowane |

---

## Faza 1 — Strona raportów i kreator

### 1.1 Routing i ochrona dostępu

**Pliki:**
- `app/reports/page.tsx` — nowa strona (re-export z main page, jak calendar/projects)
- `app/page.tsx` — dodanie taba `reports` do systemu nawigacji
- `components/layout/navigation-tabs.tsx` — dodanie zakładki "Reports" (warunkowo, tylko dla admina)

**Zakres:**
1. Utworzyć `app/reports/page.tsx`:
   ```typescript
   export { default } from '../page'
   ```
2. W `app/page.tsx`:
   - Rozszerzyć typ `activeTab` o `'reports'`
   - Dodać mapping `if (pathname.startsWith('/reports')) return 'reports'`
   - W sekcji renderowania dodać warunek: `activeTab === 'reports' && isAdmin && <ReportsView />`
3. W `components/layout/navigation-tabs.tsx`:
   - Dodać tab "Reports" widoczny tylko gdy `user.role === 'Administrator'`
   - Ikona: `FileBarChart` z lucide-react

**Ochrona server-side:**
- Nowy endpoint `/api/reports/data` zaczyna od `requireAuth(req)` + sprawdzenie `token.role === 'Administrator'`
- Jeśli rola != Administrator → `403 Forbidden`

### 1.2 Komponent ReportBuilder

**Plik:** `components/reports/report-builder.tsx`

**Układ UI:**

```
┌─────────────────────────────────────────────────────────┐
│  Reports                                    [Export ▾]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Filters ──────────────────────────────────────────┐ │
│  │ Date range: [▾ This month  ] [2026-03-01] → [03-31]│ │
│  │ Group by:   [▾ Consultant  ] [▾ Project ] [▾Client]│ │
│  │ Projects:   [▾ All projects          ]              │ │
│  │ Consultants:[▾ All consultants       ]              │ │
│  │ Billable:   [▾ All / Billable only / Non-billable ] │ │
│  │                                                     │ │
│  │                 [ Generate report ]                  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Preview ──────────────────────────────────────────┐ │
│  │ (tabela + summary cards po kliknięciu Generate)    │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Parametry raportu (typ):**
```typescript
// types/reports.ts
export interface ReportParams {
  dateFrom: string          // ISO date YYYY-MM-DD
  dateTo: string            // ISO date YYYY-MM-DD
  groupBy: 'consultant' | 'project' | 'client'
  projectIds?: string[]     // filtr opcjonalny
  consultantIds?: string[]  // filtr opcjonalny
  billable?: 'all' | 'billable' | 'non-billable'
}

export interface ReportRow {
  groupKey: string          // ID konsultanta/projektu/klienta
  groupLabel: string        // Nazwa wyświetlana
  totalHours: number
  billableHours: number
  nonBillableHours: number
  billablePercentage: number
  entryCount: number
  // Opcjonalne — zależne od grupowania
  projectCode?: string
  clientName?: string
  consultantName?: string
}

export interface ReportResult {
  params: ReportParams
  rows: ReportRow[]
  summary: {
    totalHours: number
    billableHours: number
    nonBillableHours: number
    billablePercentage: number
    uniqueProjects: number
    uniqueConsultants: number
  }
  generatedAt: string       // ISO timestamp
}
```

**Komponenty UI:**
- Selektory dat: istniejący shadcn/ui `<Popover>` + `<Calendar>` lub prosty date input
- Dropdowny: `<Select>` z shadcn/ui (multi-select dla projektów/konsultantów)
- Przycisk "Generate report": trigger fetch do `/api/reports/data`

### 1.3 Komponent ReportPreview

**Plik:** `components/reports/report-preview.tsx`

**Zawartość po wygenerowaniu:**
1. **Summary cards** (4 karty na górze):
   - Total Hours
   - Billable Hours (z %)
   - Non-billable Hours
   - Unique Projects / Consultants
2. **Tabela danych** — sortowalna po każdej kolumnie:
   | Grupa | Godziny | Billable | Non-billable | Bill. % | Wpisów |
   |---|---|---|---|---|---|
   | Jan Kowalski | 160h | 128h | 32h | 80% | 45 |
   | Anna Nowak | 152h | 140h | 12h | 92% | 38 |
3. **Wykres** (opcjonalny, Recharts) — bar chart z podziałem billable/non-billable per grupa

---

## Faza 2 — Silnik danych raportowych

### 2.1 API Endpoint: `/api/reports/data`

**Plik:** `app/api/reports/data/route.ts`

**Flow:**
```
Request (GET + query params)
  │
  ▼
requireAuth(req) ── 401 jeśli brak tokenu
  │
  ▼
requireAdmin(token) ── 403 jeśli rola != Administrator
  │
  ▼
Walidacja params (Zod schema) ── 400 jeśli błąd
  │
  ▼
dataSource.getTimeEntries({ from, to, ... })
dataSource.getProjects()
dataSource.getConsultants()
  │
  ▼
reportEngine.aggregate(entries, projects, consultants, params)
  │
  ▼
200 OK → ReportResult JSON
```

**Walidacja Zod:**
```typescript
const ReportParamsSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  groupBy: z.enum(['consultant', 'project', 'client']),
  projectIds: z.string().optional(),       // comma-separated
  consultantIds: z.string().optional(),    // comma-separated
  billable: z.enum(['all', 'billable', 'non-billable']).default('all'),
})
```

### 2.2 Report Engine

**Plik:** `lib/report-engine.ts`

**Odpowiedzialność:** Czysta logika agregacji — bez side effects, łatwa do testowania.

```typescript
export function aggregateReport(
  entries: TimeEntry[],
  projects: Project[],
  consultants: Consultant[],
  params: ReportParams
): ReportResult
```

**Algorytm:**
1. Filtrowanie wpisów po `billable` param
2. Filtrowanie po `projectIds` / `consultantIds` (jeśli podane)
3. Grupowanie wpisów po `groupBy`:
   - `consultant` → klucz = `consultantId`, label = consultant name
   - `project` → klucz = `projectId`, label = project name (+ code)
   - `client` → klucz = `project.client`, label = client name
4. Dla każdej grupy: obliczenie sumy godzin, billable/non-billable, liczby wpisów
5. Obliczenie podsumowania (summary)
6. Sortowanie: domyślnie malejąco po `totalHours`

---

## Faza 3 — Eksport CSV i XLSX

### 3.1 Moduł eksportu

**Plik:** `lib/report-export.ts`

**Eksport CSV** (bez dodatkowych zależności):
```typescript
export function generateCSV(result: ReportResult): string
```
- Nagłówek z metadanymi (zakres dat, grupowanie, data wygenerowania)
- Wiersz nagłówków kolumn
- Wiersze danych
- Wiersz podsumowania na końcu
- Encoding: UTF-8 with BOM (poprawne polskie znaki w Excel)

**Eksport XLSX** (biblioteka SheetJS / xlsx):
```typescript
export function generateXLSX(result: ReportResult): ArrayBuffer
```
- Arkusz "Report" z danymi + formatowaniem:
  - Nagłówki: bold, szare tło
  - Kolumna "Billable %": format procentowy
  - Kolumna "Godziny": format liczbowy z 1 miejscem dziesiętnym
  - Wiersz sumy na dole: bold + formuła SUM
- Arkusz "Summary" z metrykami
- Auto-fit szerokości kolumn

**Eksport — trigger w UI:**
```typescript
// components/reports/export-bar.tsx
export function ExportBar({ result }: { result: ReportResult }) {
  // Dropdown z opcjami: CSV, XLSX, PDF
  // CSV/XLSX → wywołanie generate + download via Blob URL
  // PDF → fetch do /api/reports/pdf (patrz faza 4)
}
```

**Download helper:**
```typescript
function downloadBlob(data: BlobPart, filename: string, mimeType: string) {
  const blob = new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

### 3.2 Nazewnictwo plików

Format: `tt-report-{groupBy}-{dateFrom}-{dateTo}.{ext}`

Przykład: `tt-report-consultant-2026-03-01-2026-03-31.xlsx`

---

## Faza 4 — Eksport PDF

### 4.1 API Endpoint: `/api/reports/pdf`

**Plik:** `app/api/reports/pdf/route.ts`

**Podejście:** `@react-pdf/renderer` — renderuje React komponenty do PDF bez uruchamiania przeglądarki (lżejszy niż puppeteer, brak zależności systemowych).

**Flow:**
```
POST /api/reports/pdf
  Body: ReportResult (JSON)
  │
  ▼
requireAuth + requireAdmin
  │
  ▼
renderToBuffer(<ReportPDFDocument data={result} />)
  │
  ▼
Response: application/pdf binary
```

### 4.2 Komponent PDF

**Plik:** `components/reports/report-pdf-document.tsx`

**Struktura dokumentu PDF:**
```
┌──────────────────────────────────────┐
│  DEVELOPICO TIMESHEET                │
│  Report: Hours by Consultant         │
│  Period: 2026-03-01 — 2026-03-31     │
│  Generated: 2026-03-06 14:30         │
├──────────────────────────────────────┤
│  SUMMARY                             │
│  Total: 640h  Billable: 520h (81%)   │
│  Projects: 8   Consultants: 5        │
├──────────────────────────────────────┤
│  DETAILS                             │
│  ┌────────┬──────┬────────┬───────┐  │
│  │ Name   │Hours │Billable│  %    │  │
│  ├────────┼──────┼────────┼───────┤  │
│  │ Jan K. │ 160h │  128h  │  80%  │  │
│  │ Anna N.│ 152h │  140h  │  92%  │  │
│  │ ...    │      │        │       │  │
│  ├────────┼──────┼────────┼───────┤  │
│  │ TOTAL  │ 640h │  520h  │  81%  │  │
│  └────────┴──────┴────────┴───────┘  │
├──────────────────────────────────────┤
│  Developico · Confidential           │
└──────────────────────────────────────┘
```

**Stylowanie:** @react-pdf/renderer ma własny system stylów (Flexbox-like), nie obsługuje Tailwind. Style zdefiniowane inline w komponencie PDF.

---

## Faza 5 — Predefiniowane raporty

### 5.1 Szablony raportów

**Plik:** `lib/report-presets.ts`

```typescript
export const REPORT_PRESETS: Array<{
  id: string
  label: string
  description: string
  icon: string        // lucide icon name
  params: Partial<ReportParams>
}> = [
  {
    id: 'weekly-consultant',
    label: 'Weekly by Consultant',
    description: 'Hours breakdown per consultant for the current week',
    icon: 'Users',
    params: {
      groupBy: 'consultant',
      // dateFrom/dateTo computed dynamically: current week Mon–Fri
    },
  },
  {
    id: 'monthly-project',
    label: 'Monthly by Project',
    description: 'Project hours and billable ratio for the current month',
    icon: 'FolderKanban',
    params: {
      groupBy: 'project',
      // dateFrom/dateTo: 1st to last day of current month
    },
  },
  {
    id: 'team-utilization',
    label: 'Team Utilization',
    description: 'Billable percentage per consultant for the current month',
    icon: 'BarChart3',
    params: {
      groupBy: 'consultant',
      billable: 'all',
      // dateFrom/dateTo: current month
    },
  },
  {
    id: 'billing-summary',
    label: 'Billing Summary',
    description: 'Billable hours grouped by client for invoicing',
    icon: 'Receipt',
    params: {
      groupBy: 'client',
      billable: 'billable',
      // dateFrom/dateTo: previous month
    },
  },
]
```

### 5.2 UI presetów

**W komponencie ReportBuilder** — sekcja na górze przed filtrami:

```
┌─ Quick Reports ──────────────────────────────────────┐
│                                                      │
│  [👥 Weekly by       ] [📁 Monthly by  ] [📊 Team   ]│
│  [   Consultant      ] [   Project     ] [   Util.  ]│
│                                                      │
│  [🧾 Billing Summary ]                               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Kliknięcie w preset:
1. Wypełnia filtry odpowiednimi wartościami (z dynamicznie obliczonymi datami)
2. Automatycznie uruchamia generowanie raportu

---

## Testy

### Testy jednostkowe

| Plik testowy | Co testuje | Priorytet |
|---|---|---|
| `tests/lib/report-engine.test.ts` | Agregacja, grupowanie, filtrowanie, edge cases (puste dane, jeden wpis) | 🔴 |
| `tests/lib/report-export.test.ts` | Generowanie CSV (poprawny format, BOM, polskie znaki, sumy) | 🔴 |
| `tests/lib/report-presets.test.ts` | Dynamiczne obliczanie dat dla presetów | 🟡 |

### Testy API

| Plik testowy | Co testuje | Priorytet |
|---|---|---|
| `tests/api/reports-data.test.ts` | Auth guard (401 bez tokenu, 403 dla Consultant, 200 dla Admin), walidacja Zod (400), poprawna odpowiedź | 🔴 |
| `tests/api/reports-pdf.test.ts` | Auth guard, poprawny Content-Type `application/pdf`, response is binary | 🟡 |

### Testy komponentów

| Plik testowy | Co testuje | Priorytet |
|---|---|---|
| `tests/components/report-builder.test.tsx` | Render filtrów, interakcja z presetami, wywołanie fetch po Generate | 🟡 |
| `tests/components/report-preview.test.tsx` | Renderowanie summary cards i tabeli z mock data | 🟡 |

---

## Pliki do utworzenia / modyfikacji

### Nowe pliki

| Plik | Opis |
|---|---|
| `app/reports/page.tsx` | Route re-export |
| `app/api/reports/data/route.ts` | API endpoint — dane raportowe |
| `app/api/reports/pdf/route.ts` | API endpoint — generowanie PDF |
| `types/reports.ts` | Typy: ReportParams, ReportRow, ReportResult |
| `lib/report-engine.ts` | Logika agregacji (pure functions) |
| `lib/report-export.ts` | Generowanie CSV/XLSX |
| `lib/report-presets.ts` | Predefiniowane szablony raportów |
| `components/reports/report-builder.tsx` | Kreator raportów (filtry + UI) |
| `components/reports/report-preview.tsx` | Podgląd wyników (tabela + summary) |
| `components/reports/export-bar.tsx` | Pasek eksportu (CSV/XLSX/PDF) |
| `components/reports/report-pdf-document.tsx` | Komponent @react-pdf do renderowania PDF |
| `tests/lib/report-engine.test.ts` | Testy silnika raportowego |
| `tests/lib/report-export.test.ts` | Testy eksportu CSV |
| `tests/api/reports-data.test.ts` | Testy API endpoint |

### Modyfikowane pliki

| Plik | Zmiana |
|---|---|
| `app/page.tsx` | Dodanie taba `reports`, routing, warunkowy render `<ReportsView>` |
| `components/layout/navigation-tabs.tsx` | Dodanie zakładki "Reports" (widoczna tylko dla admina) |
| `types/index.ts` | Re-export z `types/reports.ts` (opcjonalnie) |

---

## Zależności npm

| Pakiet | Cel | Wariant |
|---|---|---|
| `xlsx` (SheetJS) | Generowanie plików XLSX | devDependency: nie — potrzebny client-side w runtime |
| `@react-pdf/renderer` | Server-side PDF rendering | dependency |
| — | CSV nie wymaga dodatkowej biblioteki | — |

**Instalacja:**
```bash
pnpm add xlsx @react-pdf/renderer
```

---

## Kolejność realizacji

```
Faza 1 — Strona i kreator      ████████░░░░░░░░░░░░░░░░░░░░
  1.1 Routing + auth guard       ███
  1.2 ReportBuilder (filtry)     ███
  1.3 ReportPreview (tabela)     ██

Faza 2 — Silnik danych          ░░░░░░░░████████░░░░░░░░░░░░
  2.1 API endpoint + Zod         ███
  2.2 report-engine.ts           ████
  + testy report-engine          ██

Faza 3 — Eksport CSV/XLSX       ░░░░░░░░░░░░░░░░██████░░░░░░
  3.1 CSV generator              ██
  3.2 XLSX generator             ███
  3.3 ExportBar component        █
  + testy eksportu               ██

Faza 4 — PDF                    ░░░░░░░░░░░░░░░░░░░░░░████░░
  4.1 API /reports/pdf           ██
  4.2 PDF document component     ██

Faza 5 — Presety                ░░░░░░░░░░░░░░░░░░░░░░░░░░██
  5.1 report-presets.ts          █
  5.2 UI presetów                █
```

**Zależności między fazami:**
- Faza 1 i 2 mogą być realizowane częściowo równolegle (typy są wspólne)
- Faza 3 wymaga Fazy 2 (eksportuje ReportResult)
- Faza 4 wymaga Fazy 2 (renderuje ReportResult do PDF)
- Faza 5 wymaga Fazy 1 (presety wypełniają filtry w ReportBuilder)

---

## Definition of Done

Moduł raportowy uznaje się za gotowy gdy:

- [ ] Zakładka "Reports" widoczna WYŁĄCZNIE dla roli Administrator
- [ ] Bezpośredni dostęp do `/reports` i `/api/reports/*` przez Consultant → 403
- [ ] Kreator raportów pozwala wybrać zakres dat, grupowanie, filtry
- [ ] Podgląd raportu renderuje tabelę + summary cards
- [ ] Eksport CSV generuje poprawny plik z polskimi znakami (UTF-8 BOM)
- [ ] Eksport XLSX generuje plik z formatowaniem i formułami
- [ ] Eksport PDF generuje czytelny dokument z nagłówkiem i tabelą
- [ ] 4 presety szybkich raportów działają poprawnie
- [ ] `pnpm typecheck` pass
- [ ] `pnpm test` pass (testy silnika, eksportu i API)
- [ ] `pnpm build` pass
