# Developico Timesheet - Dokumentacja Projektu

## Spis treści

- Część 1: Funkcjonalność biznesowa
- Część 2: Architektura techniczna

---

# Część 1: Funkcjonalność biznesowa

## 1. Przegląd systemu

Developico Timesheet to aplikacja do zarządzania czasem pracy konsultantów w projektach. System umożliwia:
- Rejestrację czasu pracy w projektach
- Zarządzanie projektami i przypisaniami konsultantów
- Przeglądanie raportów wykorzystania czasu
- Śledzenie wskaźników KPI (godziny, projekty, przychody)

## 2. Ekrany i funkcjonalności

### 2.1. Dashboard (Strona główna)

**Lokalizacja:** `app/page.tsx`

**Funkcjonalności:**
- **Karty KPI** - Podsumowanie kluczowych wskaźników:
  - Łączna liczba godzin
  - Liczba aktywnych projektów
  - Liczba aktywnych konsultantów
  - Oczekujące zatwierdzenia (timesheet entries)
- **Wykres godzin tygodniowych** - Wizualizacja rozkładu godzin w ostatnich 7 dniach
- **Wykres przychodów miesięcznych** - Trend przychodów w ostatnich 6 miesiącach
- **Tabela aktywnych projektów** - Lista projektów z:
  - Nazwą i kodem projektu
  - Klientem
  - Statusem (aktywny/zakończony/wstrzymany)
  - Liczbą godzin i budżetem
  - Postępem realizacji
  - Przypisaniem do użytkownika

**Interakcje:**
- Kliknięcie projektu → przejście do szczegółów projektu
- Filtry i sortowanie w tabeli projektów

### 2.2. Calendar (Kalendarz)

**Lokalizacja:** `app/calendar/page.tsx`

**Funkcjonalności:**
- **Widok tygodniowy** - 7 dni z godzinami 8:00-18:00
- **Rejestracja wpisów czasu**:
  - Wybór projektu z listy rozwijanej
  - Wybór zadania (task)
  - Liczba godzin
  - Opis wykonanej pracy
  - Flaga billable/non-billable
- **Lista wpisów** - Tabela z zarejestrowanymi wpisami:
  - Data
  - Projekt i zadanie
  - Liczba godzin
  - Status (pending/approved/rejected)
  - Akcje (edycja/usunięcie)
- **Podsumowanie tygodnia** - Suma godzin billable i non-billable
- **Days off** - Oznaczanie dni wolnych/urlopów

**Walidacje:**
- Maksymalnie 24h dziennie
- Wymagane pole projektu i liczby godzin
- Data nie może być w przyszłości

### 2.3. Projects (Zarządzanie projektami)

**Lokalizacja:** `app/projects/page.tsx`

**Funkcjonalności:**
- **Lista projektów** - Tabela ze wszystkimi projektami:
  - Nazwa i kod
  - Klient
  - Status
  - Budżet i wykorzystane godziny
  - Daty (start/koniec)
  - Metaprojekt
  - Flaga billable/assigned
- **Filtry**:
  - Status projektu
  - Przypisanie do użytkownika
  - Billable/non-billable
  - Wyszukiwanie po nazwie/kodzie
- **Sortowanie** - Po dowolnej kolumnie
- **Dodawanie projektu** - Formularz z polami:
  - Nazwa projektu
  - Kod projektu (unikalny)
  - Klient
  - Status
  - Budżet
  - Daty realizacji
  - Notatki

**Szczegóły projektu:**
- Historia wpisów czasu
- Przypisani konsultanci
- Statystyki wykorzystania
- Notatki projektowe

### 2.4. Dashboard (Statystyki i raporty)

**Lokalizacja:** `app/dashboard/page.tsx`

**Funkcjonalności:**
- **Karty KPI**:
  - Total Hours (łączne godziny)
  - Active Projects (aktywne projekty)
  - Active Consultants (aktywni konsultanci)
  - Pending Approvals (oczekujące zatwierdzenia)
- **Wykresy**:
  - Weekly Hours Chart - Godziny w podziale na dni tygodnia
  - Monthly Revenue Trend - Trend przychodów miesięcznych
  - Project Distribution - Rozkład projektów według statusu
- **Tabele**:
  - Active Projects - Lista aktywnych projektów z postępem
  - Recent Time Entries - Ostatnie wpisy czasu

---

# Część 2: Architektura techniczna

## 1. Stack technologiczny

### 1.1. Frontend
- **Next.js 14** - App Router (React Server Components)
- **TypeScript** - Typy i bezpieczeństwo kodu
- **Tailwind CSS** - Stylowanie
- **shadcn/ui** - Komponenty UI
- **Recharts** - Wykresy i wizualizacje
- **date-fns** - Operacje na datach
- **Lucide React** - Ikony

### 1.2. Backend
- **Next.js API Routes** - Endpointy REST
- **Microsoft Dataverse** - Baza danych i logika biznesowa
- **Microsoft Entra ID** - Autentykacja i autoryzacja
- **NextAuth.js** - Session management

### 1.3. Narzędzia deweloperskie
- **pnpm** - Menedżer pakietów
- **ESLint** - Linting
- **Prettier** - Code formatting (konfiguracja w projekcie)

## 2. Struktura projektu

```
dvlp-tt/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing page / Dashboard
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   ├── metadata.ts               # SEO metadata
│   ├── calendar/                 # Calendar module
│   │   └── page.tsx              # Calendar view
│   ├── dashboard/                # Dashboard module
│   │   └── page.tsx              # Analytics dashboard
│   ├── projects/                 # Projects module
│   │   ├── page.tsx              # Projects list
│   │   └── [id]/                 # Project details
│   └── api/                      # API Routes
│       ├── dataverse/            # Dataverse endpoints
│       │   ├── timeentries/      # GET/POST time entries
│       │   ├── projects/         # GET/POST projects
│       │   └── consultants/      # GET consultants
│       └── auth/                 # NextAuth endpoints
├── components/                    # React components
│   ├── calendar/                 # Calendar components
│   │   ├── calendar-grid.tsx     # Weekly grid
│   │   ├── time-entry-form.tsx   # Entry form
│   │   └── day-off-marker.tsx    # Days off UI
│   ├── dashboard/                # Dashboard components
│   │   ├── kpi-cards.tsx         # KPI metrics
│   │   ├── weekly-hours-chart.tsx
│   │   ├── revenue-chart.tsx
│   │   └── project-analytics.tsx
│   ├── projects/                 # Project components
│   │   ├── project-table.tsx     # Projects table
│   │   ├── project-filters.tsx   # Filter controls
│   │   └── add-project-modal.tsx
│   ├── layout/                   # Layout components
│   │   ├── navbar.tsx            # Top navigation
│   │   ├── sidebar.tsx           # Side navigation
│   │   └── footer.tsx
│   ├── auth/                     # Auth components
│   │   ├── login-button.tsx
│   │   └── user-menu.tsx
│   └── ui/                       # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       └── ... (other UI primitives)
├── lib/                          # Biblioteki pomocnicze
│   ├── utils.ts                  # Utility functions
│   └── ... (other helpers)
├── data/                         # Dane i interfejsy
│   ├── dataverse.ts              # Dataverse integration layer
│   ├── interfaces.ts             # TypeScript interfaces
│   ├── mock.ts                   # Mock data for development
│   └── source.ts                 # Data source abstraction
├── hooks/                        # Custom React hooks
│   ├── use-consultants.ts        # Fetch consultants
│   ├── use-projects.ts           # Fetch projects
│   ├── use-days-off.ts           # Manage days off
│   └── ... (other hooks)
├── types/                        # Definicje typów
│   ├── project.ts                # Project types
│   ├── timeentry.ts              # Time entry types
│   └── consultant.ts             # Consultant types
├── styles/                       # Additional styles
└── public/                       # Static assets
    ├── images/
    └── icons/
```

## 3. Warstwa danych - Data Source Abstraction

**Lokalizacja:** `data/source.ts`

### 3.1. Architektura

System wykorzystuje wzorzec abstrakcji źródła danych, który pozwala na łatwe przełączanie między danymi mock a rzeczywistym Dataverse:

```typescript
// data/source.ts
export const dataSource = {
  getProjects: () => mockProjects,
  getConsultants: () => mockConsultants,
  getTimeEntries: () => mockTimeEntries,
  getDaysOff: () => mockDaysOff,
}
```

### 3.2. Tryby pracy

1. **Mock Mode** (obecny):
   - Używa danych z `data/mock.ts`
   - Dla rozwoju lokalnego bez Dataverse
   - Szybkie prototypowanie i testowanie UI

2. **Dataverse Mode** (w przygotowaniu):
   - Komunikacja z Microsoft Dataverse przez `data/dataverse.ts`
   - Wymaga konfiguracji `DATAVERSE_*` w `.env`
   - Pełna integracja z backendowym systemem

### 3.3. Interfejsy danych

**Plik:** `data/interfaces.ts`

Główne interfejsy:

```typescript
interface Project {
  id: string
  name: string
  code: string
  client: string
  status: 'active' | 'completed' | 'on-hold'
  billable: boolean
  budget?: number
  totalHours?: number
  startDate?: Date
  endDate?: Date
  metaproject?: string
  assigned?: boolean
  note?: string
}

interface TimeEntry {
  id: string
  date: Date
  projectId: string
  consultantId: string
  hours: number
  billable: boolean
  description?: string
  task?: string
  status?: 'pending' | 'approved' | 'rejected'
}

interface Consultant {
  id: string
  name: string
  email: string
  avatar?: string
  activeProjects?: number
  totalHours?: number
}

interface DayOff {
  id: string
  consultantId: string
  date: Date
  type: 'vacation' | 'sick' | 'holiday' | 'other'
  note?: string
}
```

## 4. Integracja z Microsoft Dataverse

### 4.1. Architektura integracji

**Plik:** `data/dataverse.ts`

Warstwa integracji z Dataverse zapewnia:
- Mapowanie obiektów Dataverse → interfejsy aplikacji
- Obsługę autentykacji OAuth2
- Konwersję formatów danych
- Error handling i retry logic

### 4.2. Konfiguracja połączenia

```typescript
// Zmienne środowiskowe
const config = {
  url: process.env.DATAVERSE_URL,
  clientId: process.env.DATAVERSE_CLIENT_ID,
  clientSecret: process.env.DATAVERSE_CLIENT_SECRET,
  tenantId: process.env.DATAVERSE_TENANT_ID,
}
```

### 4.3. Główne operacje

```typescript
// Pobieranie projektów
async function fetchProjects(): Promise<Project[]>

// Pobieranie wpisów czasu
async function fetchTimeEntries(
  from: Date,
  to: Date,
  consultantId?: string
): Promise<TimeEntry[]>

// Dodawanie wpisu czasu
async function createTimeEntry(entry: TimeEntry): Promise<TimeEntry>

// Aktualizacja projektu
async function updateProject(id: string, data: Partial<Project>): Promise<void>
```

## 5. Struktura tabel w Dataverse

### 5.1. tt_project (Projekty)

| Pole logiczne | Pole Dataverse | Typ | Opis |
|---------------|----------------|-----|------|
| id | tt_projectid | GUID | Klucz główny |
| name | tt_name | Text(200) | Nazwa projektu |
| code | tt_code | Text(50) | Unikalny kod projektu |
| client | tt_client | Text(200) | Nazwa klienta |
| status | tt_status | Choice | Status projektu |
| billable | tt_billable | Boolean | Czy projekt rozliczalny |
| budget | tt_budget | Money | Budżet projektu |
| startDate | tt_startdate | Date | Data rozpoczęcia |
| endDate | tt_enddate | Date | Data zakończenia |
| metaproject | tt_metaproject | Text(200) | Projekt nadrzędny |
| note | tt_note | Memo | Notatki |

**Wartości statusu:**
- `1` - Active (Aktywny)
- `2` - Completed (Zakończony)
- `3` - On Hold (Wstrzymany)

### 5.2. tt_timeregister (Wpisy czasu)

| Pole logiczne | Pole Dataverse | Typ | Opis |
|---------------|----------------|-----|------|
| id | tt_timeregisterid | GUID | Klucz główny |
| date | tt_starttime | DateTime | Data i czas wpisu |
| hours | tt_duration | Decimal | Liczba godzin |
| projectId | _tt_projectid_value | Lookup(tt_project) | Powiązanie z projektem |
| consultantId | _tt_userid_value | Lookup(systemuser) | Powiązanie z użytkownikiem |
| task | tt_task | Text(200) | Nazwa zadania |
| description | tt_note | Memo | Opis pracy |
| billable | tt_billable | Boolean | Czy wpis rozliczalny |
| status | tt_status | Choice | Status zatwierdzenia |

**Wartości statusu:**
- `1` - Pending (Oczekujący)
- `2` - Approved (Zatwierdzony)
- `3` - Rejected (Odrzucony)

### 5.3. tt_projectuser (Przypisania konsultantów do projektów)

| Pole logiczne | Pole Dataverse | Typ | Opis |
|---------------|----------------|-----|------|
| id | tt_projectuserid | GUID | Klucz główny |
| projectId | _tt_projectid_value | Lookup(tt_project) | Powiązanie z projektem |
| consultantId | _tt_userid_value | Lookup(systemuser) | Powiązanie z użytkownikiem |
| role | tt_role | Text(100) | Rola w projekcie |

### 5.4. tt_dayoff (Dni wolne)

| Pole logiczne | Pole Dataverse | Typ | Opis |
|---------------|----------------|-----|------|
| id | tt_dayoffid | GUID | Klucz główny |
| consultantId | _tt_userid_value | Lookup(systemuser) | Powiązanie z użytkownikiem |
| date | tt_date | Date | Data dnia wolnego |
| type | tt_type | Choice | Typ (urlop/choroba/święto) |
| note | tt_note | Memo | Notatka |

**Wartości typu:**
- `1` - Vacation (Urlop)
- `2` - Sick Leave (Zwolnienie)
- `3` - Holiday (Święto)
- `4` - Other (Inne)

### 5.5. systemuser (Użytkownicy - tabela systemowa)

| Pole logiczne | Pole Dataverse | Typ | Opis |
|---------------|----------------|-----|------|
| id | systemuserid | GUID | Klucz główny |
| name | fullname | Text(200) | Pełna nazwa |
| email | internalemailaddress | Email | Email użytkownika |
| avatar | entityimage_url | Text | URL do avatara |
| isDisabled | isdisabled | Boolean | Czy konto wyłączone |

## 6. Mapowanie danych

### 6.1. Project Mapping

```typescript
function mapDataverseProject(dvProject: any): Project {
  return {
    id: dvProject.tt_projectid,
    name: dvProject.tt_name,
    code: dvProject.tt_code,
    client: dvProject.tt_client,
    status: mapStatus(dvProject.tt_status),
    billable: dvProject.tt_billable ?? false,
    budget: dvProject.tt_budget,
    startDate: dvProject.tt_startdate ? new Date(dvProject.tt_startdate) : undefined,
    endDate: dvProject.tt_enddate ? new Date(dvProject.tt_enddate) : undefined,
    metaproject: dvProject.tt_metaproject,
    note: dvProject.tt_note,
  }
}
```

### 6.2. Time Entry Mapping

```typescript
function mapDataverseTimeEntry(dvEntry: any): TimeEntry {
  return {
    id: dvEntry.tt_timeregisterid,
    date: new Date(dvEntry.tt_starttime),
    projectId: dvEntry._tt_projectid_value,
    consultantId: dvEntry._tt_userid_value,
    hours: dvEntry.tt_duration,
    billable: dvEntry.tt_billable ?? false,
    description: dvEntry.tt_note,
    task: dvEntry.tt_task,
    status: mapEntryStatus(dvEntry.tt_status),
  }
}
```

## 7. API Routes

### 7.1. GET /api/dataverse/projects

**Opis:** Pobiera listę projektów

**Parametry query:**
- `status` (opcjonalny): Filtrowanie po statusie
- `assigned` (opcjonalny): Tylko przypisane do użytkownika (true/false)
- `billable` (opcjonalny): Filtrowanie po billable (true/false)

**Odpowiedź:**
```json
[
  {
    "id": "guid",
    "name": "Project Alpha",
    "code": "PROJ-001",
    "client": "Client XYZ",
    "status": "active",
    "billable": true,
    "budget": 50000,
    "totalHours": 320,
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }
]
```

### 7.2. GET /api/dataverse/timeentries

**Opis:** Pobiera wpisy czasu

**Parametry query:**
- `from`: Data początkowa (YYYY-MM-DD) - wymagane
- `to`: Data końcowa (YYYY-MM-DD) - wymagane
- `consultantId` (opcjonalny): ID konsultanta
- `projectId` (opcjonalny): ID projektu
- `billable` (opcjonalny): Filtrowanie po billable (true/false)

**Odpowiedź:**
```json
[
  {
    "id": "guid",
    "date": "2024-01-15",
    "projectId": "guid",
    "consultantId": "guid",
    "hours": 8.0,
    "billable": true,
    "description": "Development work",
    "task": "Feature implementation",
    "status": "pending"
  }
]
```

### 7.3. POST /api/dataverse/timeentries

**Opis:** Dodaje nowy wpis czasu

**Body:**
```json
{
  "date": "2024-01-15",
  "projectId": "guid",
  "hours": 8.0,
  "billable": true,
  "description": "Development work",
  "task": "Feature implementation"
}
```

**Odpowiedź:**
```json
{
  "id": "new-guid",
  "date": "2024-01-15",
  "projectId": "guid",
  "consultantId": "current-user-guid",
  "hours": 8.0,
  "billable": true,
  "description": "Development work",
  "task": "Feature implementation",
  "status": "pending"
}
```

### 7.4. GET /api/dataverse/consultants

**Opis:** Pobiera listę konsultantów

**Odpowiedź:**
```json
[
  {
    "id": "guid",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "avatar": "https://...",
    "activeProjects": 3,
    "totalHours": 160
  }
]
```

## 8. Autentykacja i autoryzacja

### 8.1. NextAuth.js Configuration

**Plik:** `pages/api/auth/[...nextauth].ts`

```typescript
export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.idToken = account.id_token
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.idToken = token.idToken
      return session
    },
  },
}
```

### 8.2. Przepływ autentykacji

1. Użytkownik klika "Sign in"
2. Przekierowanie do Entra ID (Azure AD)
3. Użytkownik loguje się credentials korporacyjnymi
4. Entra ID zwraca token (access_token + id_token)
5. NextAuth zapisuje session
6. Token używany do wywołań Dataverse API

### 8.3. Protected Routes

```typescript
// Example: Protected page
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { redirect } from 'next/navigation'

export default async function ProtectedPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/api/auth/signin')
  }
  
  return <div>Protected content</div>
}
```

### 8.4. Mapowanie użytkowników

**Problem:** 
- Entra ID używa `oid` (Object ID)
- Dataverse używa `systemuserid` (różne GUID)

**Rozwiązanie:**
- Pole `azureactivedirectoryobjectid` w tabeli `systemuser`
- Mapowanie przy pierwszym logowaniu
- Cache mapowania w session

## 9. Custom Hooks

### 9.1. useProjects

```typescript
// hooks/use-projects.ts
export function useProjects(filters?: ProjectFilters) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchProjects(filters)
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [filters])
  
  return { projects, loading, refetch: () => fetchProjects(filters) }
}
```

### 9.2. useConsultants

```typescript
// hooks/use-consultants.ts
export function useConsultants() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchConsultants()
      .then(setConsultants)
      .finally(() => setLoading(false))
  }, [])
  
  return { consultants, loading }
}
```

### 9.3. useDaysOff

```typescript
// hooks/use-days-off.ts
export function useDaysOff(consultantId: string, month: Date) {
  const [daysOff, setDaysOff] = useState<DayOff[]>([])
  const [loading, setLoading] = useState(true)
  
  const addDayOff = async (dayOff: DayOff) => {
    // API call to add day off
  }
  
  const removeDayOff = async (id: string) => {
    // API call to remove day off
  }
  
  return { daysOff, loading, addDayOff, removeDayOff }
}
```

## 10. Komponenty UI (shadcn/ui)

### 10.1. Wykorzystane komponenty

- **Button** - Przyciski akcji
- **Card** - Karty z treścią
- **Dialog** - Modale i dialogi
- **Input** - Pola tekstowe
- **Select** - Listy rozwijane
- **Table** - Tabele danych
- **Tabs** - Zakładki
- **Calendar** - Picker dat
- **Checkbox** - Pola wyboru
- **Badge** - Oznaczenia statusów
- **Avatar** - Awatary użytkowników
- **Tooltip** - Podpowiedzi

### 10.2. Customizacja

Komponenty są w pełni customizowalne przez:
- Tailwind classes
- CSS variables (`:root` w `globals.css`)
- Variant props (np. `variant="outline"`)

### 10.3. Theme Configuration

```css
/* app/globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  /* ... więcej zmiennych */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... dark mode variables */
}
```

## 11. Stylowanie i Design System

### 11.1. Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--foreground))",
        },
        // ... więcej kolorów
      },
    },
  },
}
```

### 11.2. Konwencje nazewnictwa klas

- `className="flex items-center gap-4"` - Utility classes
- `className="text-sm font-medium"` - Typography
- `className="rounded-lg border bg-card"` - Component styling
- `className="hover:bg-accent transition-colors"` - Interakcje

### 11.3. Responsive Design

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Responsive grid */}
</div>
```

Breakpoints:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

## 12. Optymalizacja wydajności

### 12.1. React Server Components

Większość komponentów to Server Components (domyślnie w Next.js App Router):
- Renderowanie na serwerze
- Mniejszy bundle JavaScript
- Bezpośredni dostęp do danych

Client Components (`'use client'`) tylko gdy potrzebne:
- Interaktywność (onClick, useState)
- Browser APIs (localStorage, window)
- React hooks (useEffect, useState)

### 12.2. Data Fetching

```typescript
// Server Component - fetch on server
async function ProjectsPage() {
  const projects = await fetchProjects() // Direct API call
  return <ProjectTable projects={projects} />
}

// Client Component - fetch on client
'use client'
function ProjectsWidget() {
  const { projects, loading } = useProjects() // Hook with state
  if (loading) return <Skeleton />
  return <ProjectTable projects={projects} />
}
```

### 12.3. Caching Strategy

- **Server-side**: Next.js automatic caching dla fetch requests
- **Client-side**: React Query / SWR dla hookóe (w przyszłości)
- **Dataverse**: Token cache z auto-refresh

### 12.4. Code Splitting

```typescript
// Dynamic imports dla ciężkich komponentów
import dynamic from 'next/dynamic'

const HeavyChart = dynamic(() => import('@/components/heavy-chart'), {
  loading: () => <Skeleton />,
  ssr: false, // Disable SSR jeśli używa browser APIs
})
```

## 13. Testowanie

### 13.1. Setup (w przyszłości)

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
```

### 13.2. Przykładowe testy

```typescript
// __tests__/components/project-table.test.tsx
import { render, screen } from '@testing-library/react'
import { ProjectTable } from '@/components/projects/project-table'

describe('ProjectTable', () => {
  it('renders projects correctly', () => {
    const projects = [
      { id: '1', name: 'Test Project', code: 'TEST-001', ... }
    ]
    
    render(<ProjectTable projects={projects} />)
    
    expect(screen.getByText('Test Project')).toBeInTheDocument()
    expect(screen.getByText('TEST-001')).toBeInTheDocument()
  })
})
```

### 13.3. API Tests

```typescript
// __tests__/api/projects.test.ts
import { GET } from '@/app/api/dataverse/projects/route'

describe('/api/dataverse/projects', () => {
  it('returns projects list', async () => {
    const response = await GET(new Request('http://localhost/api/dataverse/projects'))
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
  })
})
```

## 14. Deployment

### 14.1. Zmienne środowiskowe

```bash
# .env.local (development)
NEXT_PUBLIC_USE_MOCK=true

# Dataverse
DATAVERSE_URL=https://org.crm.dynamics.com
DATAVERSE_CLIENT_ID=xxx
DATAVERSE_CLIENT_SECRET=xxx
DATAVERSE_TENANT_ID=xxx

# Azure AD / Entra ID
AZURE_AD_CLIENT_ID=xxx
AZURE_AD_CLIENT_SECRET=xxx
AZURE_AD_TENANT_ID=xxx

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generated-secret-key
```

### 14.2. Build Commands

```bash
# Development
pnpm dev              # Start dev server (localhost:3000)

# Production build
pnpm build            # Create optimized build
pnpm start            # Start production server

# Quality checks
pnpm lint             # Run ESLint
pnpm typecheck        # TypeScript validation (jeśli skonfigurowane)
```

### 14.3. Deployment Platforms

**Vercel (zalecane):**
```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel --prod
```

**Azure Static Web Apps:**
```bash
# GitHub Actions workflow
# .github/workflows/azure-static-web-apps.yml
```

**Docker:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
CMD ["pnpm", "start"]
```

### 14.4. Environment-specific configs

```javascript
// next.config.mjs
const config = {
  reactStrictMode: true,
  
  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    compiler: {
      removeConsole: true, // Remove console.logs
    },
  }),
  
  // Environment variables exposed to browser
  env: {
    NEXT_PUBLIC_USE_MOCK: process.env.NEXT_PUBLIC_USE_MOCK,
  },
}
```

## 15. Bezpieczeństwo

### 15.1. Authentication Flow

1. User → Click "Sign In"
2. NextAuth → Redirect to Entra ID
3. Entra ID → User authenticates
4. Entra ID → Returns tokens to NextAuth
5. NextAuth → Creates session with tokens
6. App → Uses tokens for Dataverse API calls

### 15.2. API Security

```typescript
// Przykład zabezpieczonego API route
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'

export async function GET(req: Request) {
  // Check authentication
  const session = await getServerSession(authOptions)
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  // Check authorization (przykład)
  if (!session.user.roles?.includes('TimeEntry.Read')) {
    return new Response('Forbidden', { status: 403 })
  }
  
  // Process request
  const data = await fetchData(session.accessToken)
  return Response.json(data)
}
```

### 15.3. CORS Configuration

```typescript
// next.config.mjs
const config = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGIN || '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
}
```

### 15.4. Data Validation

```typescript
// Przykład z zod
import { z } from 'zod'

const timeEntrySchema = z.object({
  date: z.string().datetime(),
  projectId: z.string().uuid(),
  hours: z.number().min(0).max(24),
  billable: z.boolean(),
  description: z.string().max(1000).optional(),
})

export async function POST(req: Request) {
  const body = await req.json()
  
  // Validate input
  const result = timeEntrySchema.safeParse(body)
  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 })
  }
  
  // Process valid data
  const entry = await createTimeEntry(result.data)
  return Response.json(entry)
}
```

## 16. Monitoring i Logging

### 16.1. Application Insights (Azure)

```typescript
// lib/app-insights.ts
import { ApplicationInsights } from '@microsoft/applicationinsights-web'

const appInsights = new ApplicationInsights({
  config: {
    connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  }
})

appInsights.loadAppInsights()
appInsights.trackPageView()

export { appInsights }
```

### 16.2. Custom Logging

```typescript
// lib/logger.ts
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, meta)
    // Send to logging service
  },
  
  error: (message: string, error?: Error) => {
    console.error(`[ERROR] ${message}`, error)
    // Send to error tracking service (e.g., Sentry)
  },
  
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${message}`, meta)
  },
}
```

### 16.3. Performance Monitoring

```typescript
// Measure component render time
'use client'
import { useEffect } from 'react'

export function PerformanceMonitor({ componentName, children }) {
  useEffect(() => {
    const start = performance.now()
    
    return () => {
      const duration = performance.now() - start
      logger.info(`${componentName} render time: ${duration}ms`)
    }
  }, [componentName])
  
  return children
}
```

## 17. Migracja danych

### 17.1. Mock → Dataverse Migration Plan

**Phase 1: Preparation**
1. Verify Dataverse schema matches interfaces
2. Set up service principal for Dataverse
3. Test connection and authentication
4. Create migration scripts

**Phase 2: Implementation**
1. Implement `data/dataverse.ts` functions
2. Add feature flag: `NEXT_PUBLIC_USE_DATAVERSE=true`
3. Dual-mode support (mock + dataverse)
4. Gradual rollout per module

**Phase 3: Validation**
1. Compare mock vs dataverse data
2. Performance testing
3. User acceptance testing
4. Monitor errors and fix issues

**Phase 4: Cutover**
1. Set `NEXT_PUBLIC_USE_MOCK=false` in production
2. Remove mock data code (optional)
3. Monitor production metrics

### 17.2. Migration Script Example

```typescript
// scripts/migrate-to-dataverse.ts
import { mockProjects } from '@/data/mock'
import { createProject } from '@/data/dataverse'

async function migrateProjects() {
  console.log('Starting project migration...')
  
  for (const project of mockProjects) {
    try {
      await createProject(project)
      console.log(`✓ Migrated: ${project.name}`)
    } catch (error) {
      console.error(`✗ Failed: ${project.name}`, error)
    }
  }
  
  console.log('Migration complete!')
}

migrateProjects()
```

## 18. Znane ograniczenia i TODO

### 18.1. Obecne ograniczenia

- Brak rzeczywistej integracji z Dataverse (mock data only)
- Brak autentykacji użytkowników w mock mode
- Brak walidacji uprawnień (security roles)
- Brak obsługi offline
- Brak powiadomień w czasie rzeczywistym
- Brak eksportu raportów (Excel/PDF)

### 18.2. Planowane funkcjonalności

**Q1 2025:**
- [ ] Implementacja Dataverse integration
- [ ] NextAuth + Entra ID authentication
- [ ] Dodawanie/edycja projektów
- [ ] Dodawanie/edycja wpisów czasu
- [ ] Zatwierdzanie timesheet entries

**Q2 2025:**
- [ ] Raporty i eksport do Excel
- [ ] Powiadomienia email
- [ ] Zarządzanie uprawnieniami
- [ ] Audit log
- [ ] Zaawansowane filtry i wyszukiwanie

**Q3 2025:**
- [ ] Mobile app (React Native / PWA)
- [ ] Offline support
- [ ] Real-time updates (SignalR)
- [ ] Integration z Microsoft Teams

**Q4 2025:**
- [ ] AI-powered time suggestions
- [ ] Predictive analytics
- [ ] Resource optimization
- [ ] Integration z systemami finansowymi

## 19. Wsparcie i rozwój

### 19.1. Dokumentacja techniczna

- **README.md** - Podstawowe informacje o projekcie
- **DOCUMENTATION.md** (ten plik) - Pełna dokumentacja
- Inline comments w kodzie
- TypeScript types jako dokumentacja API

### 19.2. Contributing Guidelines

```markdown
# Contributing to Developico Timesheet

## Code Style
- Follow existing code conventions
- Use TypeScript strict mode
- Write meaningful commit messages
- Add comments for complex logic

## Pull Request Process
1. Create feature branch from `main`
2. Implement changes with tests
3. Run `pnpm lint` and fix issues
4. Update documentation if needed
5. Submit PR with description

## Commit Message Format
- feat: Add new feature
- fix: Bug fix
- docs: Documentation update
- style: Code style changes
- refactor: Code refactoring
- test: Add tests
- chore: Build/config changes
```

### 19.3. Kontakt

- **Tech Lead:** [Name]
- **Email:** [email]
- **Teams Channel:** [link]
- **Documentation:** [confluence/wiki link]

---

## Appendix A: Przykładowe dane (Mock)

### A.1. Mock Projects

```typescript
const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Internal - Development',
    code: 'INT-DEV',
    client: 'Developico',
    status: 'active',
    billable: false,
    budget: 100000,
    totalHours: 1250,
    startDate: new Date('2024-01-01'),
    assigned: true,
  },
  {
    id: '2',
    name: 'Client Portal',
    code: 'CP-2024',
    client: 'ABC Corporation',
    status: 'active',
    billable: true,
    budget: 75000,
    totalHours: 580,
    startDate: new Date('2024-03-01'),
    endDate: new Date('2024-12-31'),
    assigned: true,
  },
  // ... więcej projektów
]
```

### A.2. Mock Time Entries

```typescript
const mockTimeEntries: TimeEntry[] = [
  {
    id: '1',
    date: new Date('2024-01-15'),
    projectId: '1',
    consultantId: 'c1',
    hours: 8,
    billable: false,
    description: 'Sprint planning and backlog refinement',
    task: 'Project Management',
    status: 'approved',
  },
  {
    id: '2',
    date: new Date('2024-01-15'),
    projectId: '2',
    consultantId: 'c1',
    hours: 6.5,
    billable: true,
    description: 'Implemented user authentication module',
    task: 'Backend Development',
    status: 'pending',
  },
  // ... więcej wpisów
]
```

### A.3. Mock Consultants

```typescript
const mockConsultants: Consultant[] = [
  {
    id: 'c1',
    name: 'John Doe',
    email: 'john.doe@developico.com',
    avatar: 'https://i.pravatar.cc/150?img=1',
    activeProjects: 3,
    totalHours: 160,
  },
  {
    id: 'c2',
    name: 'Jane Smith',
    email: 'jane.smith@developico.com',
    avatar: 'https://i.pravatar.cc/150?img=2',
    activeProjects: 2,
    totalHours: 140,
  },
  // ... więcej konsultantów
]
```

---

## Appendix B: Dataverse OData Query Examples

### B.1. Fetch Projects (Active, Billable)

```
GET /api/data/v9.2/tt_projects?
  $filter=tt_status eq 1 and tt_billable eq true and statecode eq 0
  &$select=tt_projectid,tt_name,tt_code,tt_client,tt_budget
  &$orderby=tt_name asc
```

### B.2. Fetch Time Entries (Date Range)

```
GET /api/data/v9.2/tt_timeregisters?
  $filter=tt_starttime ge 2024-01-01 and tt_starttime lt 2024-02-01
  &$expand=tt_projectid($select=tt_name,tt_code)
  &$select=tt_timeregisterid,tt_starttime,tt_duration,tt_note
  &$orderby=tt_starttime desc
```

### B.3. Fetch User Projects (Assigned)

```
GET /api/data/v9.2/tt_projectusers?
  $filter=_tt_userid_value eq {userId}
  &$expand=tt_projectid($select=tt_name,tt_code,tt_status)
  &$select=tt_projectuserid
```

### B.4. Create Time Entry

```
POST /api/data/v9.2/tt_timeregisters
Content-Type: application/json

{
  "tt_starttime": "2024-01-15T08:00:00Z",
  "tt_duration": 8.0,
  "tt_note": "Development work",
  "tt_task": "Feature implementation",
  "tt_billable": true,
  "tt_projectid@odata.bind": "/tt_projects(project-guid)",
  "tt_userid@odata.bind": "/systemusers(user-guid)"
}
```

---

## Appendix C: TypeScript Type Definitions

### C.1. Core Types

```typescript
// types/project.ts
export type ProjectStatus = 'active' | 'completed' | 'on-hold'

export interface Project {
  id: string
  name: string
  code: string
  client: string
  status: ProjectStatus
  billable: boolean
  budget?: number
  totalHours?: number
  startDate?: Date
  endDate?: Date
  metaproject?: string
  assigned?: boolean
  note?: string
  createdOn?: Date
  modifiedOn?: Date
}

// types/timeentry.ts
export type TimeEntryStatus = 'pending' | 'approved' | 'rejected'

export interface TimeEntry {
  id: string
  date: Date
  projectId: string
  consultantId: string
  hours: number
  billable: boolean
  description?: string
  task?: string
  status?: TimeEntryStatus
  createdOn?: Date
  modifiedOn?: Date
}

// types/consultant.ts
export interface Consultant {
  id: string
  name: string
  email: string
  avatar?: string
  activeProjects?: number
  totalHours?: number
  isDisabled?: boolean
}

// types/dayoff.ts
export type DayOffType = 'vacation' | 'sick' | 'holiday' | 'other'

export interface DayOff {
  id: string
  consultantId: string
  date: Date
  type: DayOffType
  note?: string
}
```

### C.2. API Response Types

```typescript
// types/api.ts
export interface ApiResponse<T> {
  data: T
  error?: string
  timestamp: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface DataverseResponse<T> {
  '@odata.context': string
  value: T[]
  '@odata.count'?: number
  '@odata.nextLink'?: string
}
```

---

**Ostatnia aktualizacja:** 28 października 2025  
**Wersja dokumentacji:** 1.0  
**Projekt:** dvlp-tt (Developico Timesheet)  
**Status:** Development (Mock Mode)
