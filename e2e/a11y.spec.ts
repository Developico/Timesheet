import { test, expect } from './fixtures'
import AxeBuilder from '@axe-core/playwright'

// Reuse mock data stubs from app.spec.ts
function mockDataverseRoutes(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route('**/api/dataverse/projects', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: [] }) }),
    ),
    page.route('**/api/dataverse/consultants', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: [] }) }),
    ),
    page.route('**/api/dataverse/timeentries*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: [] }) }),
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

test.describe('Accessibility (axe-core)', () => {
  test('sign-in page has no critical a11y violations', async ({ page }) => {
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    )
    await page.goto('/')
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 10_000 })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    expect(results.violations.filter(v => v.impact === 'critical')).toEqual([])
  })

  test('dashboard has no critical a11y violations', async ({ authedPage: page }) => {
    await mockDataverseRoutes(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Timesheet' })).toBeVisible({ timeout: 10_000 })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    expect(results.violations.filter(v => v.impact === 'critical')).toEqual([])
  })

  test('calendar page has no critical a11y violations', async ({ authedPage: page }) => {
    await mockDataverseRoutes(page)
    await page.goto('/calendar')
    await expect(page.getByText('Mon').first()).toBeVisible({ timeout: 10_000 })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    expect(results.violations.filter(v => v.impact === 'critical')).toEqual([])
  })

  test('projects page has no critical a11y violations', async ({ authedPage: page }) => {
    await mockDataverseRoutes(page)
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    expect(results.violations.filter(v => v.impact === 'critical')).toEqual([])
  })
})
