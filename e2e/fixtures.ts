import { test as base, type Page } from '@playwright/test'

/**
 * Fixture that intercepts NextAuth session endpoint to simulate an
 * authenticated user. This avoids any real Azure AD interaction during E2E.
 */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    // Mock the NextAuth session endpoint — the SessionProvider polls this
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'e2e-user-001',
            name: 'E2E Test User',
            email: 'e2e@developico.com',
            role: 'Administrator',
            roles: ['Administrator'],
            image: '/placeholder-user.jpg',
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      }),
    )

    // Mock CSRF token (needed by NextAuth client)
    await page.route('**/api/auth/csrf', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'e2e-csrf-token' }),
      }),
    )

    // Mock providers endpoint
    await page.route('**/api/auth/providers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          'azure-ad': {
            id: 'azure-ad',
            name: 'Azure AD',
            type: 'oauth',
            signinUrl: '/api/auth/signin/azure-ad',
            callbackUrl: '/api/auth/callback/azure-ad',
          },
        }),
      }),
    )

    // Mock photo endpoint (no avatar)
    await page.route('**/api/me/photo', (route) =>
      route.fulfill({ status: 204 }),
    )

    await use(page)
  },
})

export { expect } from '@playwright/test'
