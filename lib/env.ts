import { z } from 'zod'

/**
 * Zod schema for server-side environment variables.
 * Required vars will cause a clear startup error if missing.
 * Optional vars fall back to defaults.
 */
const serverEnvSchema = z.object({
  // --- Auth (required in production) ---
  AZURE_AD_CLIENT_ID: z.string().min(1, 'AZURE_AD_CLIENT_ID is required'),
  AZURE_AD_CLIENT_SECRET: z.string().min(1, 'AZURE_AD_CLIENT_SECRET is required'),
  AZURE_AD_TENANT_ID: z.string().min(1, 'AZURE_AD_TENANT_ID is required'),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
  NEXTAUTH_URL: z.string().url().optional(),
  AZURE_AD_APP_SCOPE: z.string().optional(),

  // --- Group IDs (server-only, prefer new names) ---
  ADMIN_GROUP_ID: z.string().optional(),
  CONSULTANT_GROUP_ID: z.string().optional(),
  // Legacy names (backward compat)
  NEXT_PUBLIC_ADMIN_GROUP: z.string().optional(),
  NEXT_PUBLIC_CONSULTANT_GROUP: z.string().optional(),
  AZURE_AD_CONSULTANTS_GROUP_ID: z.string().optional(),
  CONSULTANTS_GROUP_ID: z.string().optional(),

  // --- Dataverse ---
  DATAVERSE_ENABLED: z.enum(['true', 'false']).default('false'),
  DATAVERSE_URL: z.string().url().optional(),
  DATAVERSE_TENANT_ID: z.string().optional(),
  DATAVERSE_CLIENT_ID: z.string().optional(),
  DATAVERSE_CLIENT_SECRET: z.string().optional(),

  // --- Runtime ---
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_USE_MOCK: z.enum(['true', 'false']).default('true'),
  LOG_MODE: z.enum(['console', 'file', 'silent']).optional(),
  VOLATILE_STORE_PERSIST: z.enum(['true', 'false']).default('false'),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

function parseEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    // In development, log and continue with defaults; in production, fail hard
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Environment validation failed:\n${formatted}`)
    }
    // eslint-disable-next-line no-console
    console.warn(`[env] Validation warnings (non-fatal in dev):\n${formatted}`)
    // Return partial parse with defaults applied
    return serverEnvSchema.parse({
      ...process.env,
      AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID || 'placeholder',
      AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET || 'placeholder',
      AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID || 'placeholder',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'placeholder',
    })
  }
  return result.data
}

export const env = parseEnv()
