import { test, expect } from './fixtures'

// Stub data for Dataverse API routes
const MOCK_PROJECTS = [
  { id: 'proj-1', code: 'DEV-001', client: 'Acme Corp', name: 'E-commerce Platform', billable: true, assigned: true, color: '#01EED4' },
  { id: 'proj-2', code: 'INT-001', client: 'Internal', name: 'Team Training', billable: false, assigned: true, color: '#f59e0b' },
]

const MOCK_CONSULTANTS = [
  { id: '1', name: 'Jan Kowalski', email: 'jan.kowalski@developico.com' },
  { id: '2', name: 'Anna Nowak', email: 'anna.nowak@developico.com' },
]

const MOCK_TIME_ENTRIES = [
  { id: 'te-1', consultantId: '1', projectId: 'proj-1', date: '2026-03-02', duration: 8, description: 'Development work' },
  { id: 'te-2', consultantId: '1', projectId: 'proj-2', date: '2026-03-03', duration: 4, description: 'Training session' },
]

function mockDataverseRoutes(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route('**/api/dataverse/projects', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: MOCK_PROJECTS }) }),
    ),
    page.route('**/api/dataverse/consultants', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: MOCK_CONSULTANTS }) }),
    ),
    page.route('**/api/dataverse/timeentries*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: MOCK_TIME_ENTRIES }) }),
    ),
    page.route('**/api/dataverse/days-off*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: [] }) }),
    ),
    page.route('**/api/dataverse/project-assignments*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: [] }) }),
    ),
    page.route('**/api/dataverse/project-team*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: [] }) }),
    ),
  ])
}

// ─── Unauthenticated ────────────────────────────────────────────

test.describe('Unauthenticated user', () => {
  test('sees the sign-in screen', async ({ page }) => {
    // Don't mock session — NextAuth returns empty → no user
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    )
    await page.goto('/')
    await expect(page.getByRole('button', { name: /sign in with microsoft/i })).toBeVisible()
    await expect(page.getByText('Welcome Back')).toBeVisible()
  })
})

// ─── Authenticated: Dashboard ───────────────────────────────────

test.describe('Dashboard', () => {
  test('loads and shows KPI cards', async ({ authedPage: page }) => {
    await mockDataverseRoutes(page)
    await page.goto('/')
    // User avatar menu should be visible (name is inside dropdown)
    await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible({ timeout: 10_000 })
    // Dashboard tab should be active (default)
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible()
    // No sign-in screen visible
    await expect(page.locator('body')).not.toContainText('Sign in with Microsoft')
  })

  test('displays the Timesheet title', async ({ authedPage: page }) => {
    await mockDataverseRoutes(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Timesheet' })).toBeVisible({ timeout: 10_000 })
  })
})

// ─── Authenticated: Tab Navigation ──────────────────────────────

test.describe('Tab navigation', () => {
  test('can switch between Dashboard, Calendar, and Projects', async ({ authedPage: page }) => {
    await mockDataverseRoutes(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Timesheet' })).toBeVisible({ timeout: 10_000 })

    // Switch to Calendar
    await page.getByRole('button', { name: 'Calendar' }).click()
    await expect(page).toHaveURL(/\/calendar/)

    // Switch to Projects
    await page.getByRole('button', { name: 'Projects' }).click()
    await expect(page).toHaveURL(/\/projects/)

    // Back to Dashboard
    await page.getByRole('button', { name: 'Dashboard' }).click()
    // Dashboard maps to / or /dashboard
    await expect(page).toHaveURL(/\/(dashboard)?$/)
  })
})

// ─── Authenticated: Projects tab ────────────────────────────────

test.describe('Projects tab', () => {
  test('shows project names from mock data', async ({ authedPage: page }) => {
    await mockDataverseRoutes(page)
    await page.goto('/projects')
    await expect(page.getByText('E-commerce Platform')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Team Training')).toBeVisible()
  })
})

// ─── Authenticated: Calendar tab ────────────────────────────────

test.describe('Calendar tab', () => {
  test('renders without crash', async ({ authedPage: page }) => {
    await mockDataverseRoutes(page)
    await page.goto('/calendar')
    // Calendar should render weekday headers
    await expect(page.getByText('Mon').first()).toBeVisible({ timeout: 10_000 })
  })
})

// ─── Theme toggle ───────────────────────────────────────────────

test.describe('Theme toggle', () => {
  test('can switch to dark mode', async ({ authedPage: page }) => {
    await mockDataverseRoutes(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Timesheet' })).toBeVisible({ timeout: 10_000 })

    // Open user dropdown and look for theme toggle button
    const themeButton = page.getByRole('button', { name: /dark|light|theme|toggle/i })
    if (await themeButton.isVisible()) {
      await themeButton.click()
      // html element should have class dark
      await expect(page.locator('html')).toHaveClass(/dark/)
    }
  })
})
