import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──────────────────────────────────────────────────────────────
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}))

vi.mock('@/data/source', () => ({
  getDataSource: vi.fn(),
}))

vi.mock('@/lib/dataverse-user-map', () => ({
  mapAadOidToConsultantId: vi.fn(),
}))

vi.mock('@/lib/app-logger', () => ({
  appLog: vi.fn(),
  withCorrelation: vi.fn((_prefix: string, fn: (cid: string) => unknown) =>
    fn('test-cid'),
  ),
}))

import { getToken } from 'next-auth/jwt'
import { getDataSource } from '@/data/source'
import { mapAadOidToConsultantId } from '@/lib/dataverse-user-map'

const mockedGetToken = vi.mocked(getToken)
const mockedGetDataSource = vi.mocked(getDataSource)
const mockedMapOid = vi.mocked(mapAadOidToConsultantId)

// ── Helpers ────────────────────────────────────────────────────────────
function req(path: string) {
  return new NextRequest(new URL(path, 'http://localhost:3000'))
}

function stubDs(overrides: Record<string, unknown> = {}) {
  const ds = {
    getConsultants: vi.fn().mockResolvedValue([]),
    getProjects: vi.fn().mockResolvedValue([]),
    getTimeEntries: vi.fn().mockResolvedValue([]),
    getProjectAssignments: vi.fn().mockResolvedValue([]),
    getProjectTeam: vi.fn().mockResolvedValue([]),
    getDaysOff: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
  mockedGetDataSource.mockReturnValue(ds as never)
  return ds
}

function authOk(oid = 'test-oid') {
  mockedGetToken.mockResolvedValue({ oid } as never)
}

// ── Shared auth tests ──────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXTAUTH_SECRET = 'test-secret'
})

// ── Consultants ────────────────────────────────────────────────────────
describe('GET /api/dataverse/consultants', () => {
  let handler: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    const mod = await import('@/app/api/dataverse/consultants/route')
    handler = mod.GET
  })

  it('returns 401 without token', async () => {
    mockedGetToken.mockResolvedValue(null)
    const res = await handler(req('/api/dataverse/consultants'))
    expect(res.status).toBe(401)
  })

  it('returns consultants on success', async () => {
    authOk()
    const data = [{ id: 'c1', name: 'Alice' }]
    stubDs({ getConsultants: vi.fn().mockResolvedValue(data) })
    const res = await handler(req('/api/dataverse/consultants'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.value).toEqual(data)
  })

  it('returns 500 on data source error', async () => {
    authOk()
    stubDs({ getConsultants: vi.fn().mockRejectedValue(new Error('boom')) })
    const res = await handler(req('/api/dataverse/consultants'))
    expect(res.status).toBe(500)
  })
})

// ── Days off ───────────────────────────────────────────────────────────
describe('GET /api/dataverse/days-off', () => {
  let handler: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    const mod = await import('@/app/api/dataverse/days-off/route')
    handler = mod.GET
  })

  it('returns 401 without token', async () => {
    mockedGetToken.mockResolvedValue(null)
    const res = await handler(req('/api/dataverse/days-off?from=2025-01-01&to=2025-01-31'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid date range', async () => {
    authOk()
    stubDs()
    const res = await handler(req('/api/dataverse/days-off?from=bad&to=also-bad'))
    expect(res.status).toBe(400)
  })

  it('returns days off on success', async () => {
    authOk()
    const data = [{ date: '2025-01-01', name: 'New Year' }]
    stubDs({ getDaysOff: vi.fn().mockResolvedValue(data) })
    const res = await handler(req('/api/dataverse/days-off?from=2025-01-01&to=2025-01-31'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.value).toEqual(data)
  })
})

// ── Project assignments ────────────────────────────────────────────────
describe('GET /api/dataverse/project-assignments', () => {
  let handler: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    const mod = await import('@/app/api/dataverse/project-assignments/route')
    handler = mod.GET
  })

  it('returns 401 without token', async () => {
    mockedGetToken.mockResolvedValue(null)
    const res = await handler(req('/api/dataverse/project-assignments'))
    expect(res.status).toBe(401)
  })

  it('maps OID to consultantId and returns assignments', async () => {
    authOk('oid-123')
    mockedMapOid.mockResolvedValue('c-456')
    stubDs({ getProjectAssignments: vi.fn().mockResolvedValue(['p1', 'p2']) })
    const res = await handler(req('/api/dataverse/project-assignments'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.value).toEqual(['p1', 'p2'])
    expect(json.consultantId).toBe('c-456')
  })

  it('returns empty when no consultantId resolved', async () => {
    authOk()
    mockedMapOid.mockResolvedValue(null as never)
    stubDs()
    const res = await handler(req('/api/dataverse/project-assignments'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.value).toEqual([])
  })
})

// ── Project team ───────────────────────────────────────────────────────
describe('GET /api/dataverse/project-team', () => {
  let handler: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    const mod = await import('@/app/api/dataverse/project-team/route')
    handler = mod.GET
  })

  it('returns 401 without token', async () => {
    mockedGetToken.mockResolvedValue(null)
    const res = await handler(req('/api/dataverse/project-team?projectId=p1'))
    expect(res.status).toBe(401)
  })

  it('returns 400 without projectId', async () => {
    authOk()
    stubDs()
    const res = await handler(req('/api/dataverse/project-team'))
    expect(res.status).toBe(400)
  })

  it('returns team members on success', async () => {
    authOk()
    stubDs({ getProjectTeam: vi.fn().mockResolvedValue(['c1', 'c2']) })
    const res = await handler(req('/api/dataverse/project-team?projectId=p1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.value).toEqual(['c1', 'c2'])
  })
})

// ── Projects ───────────────────────────────────────────────────────────
describe('GET /api/dataverse/projects', () => {
  let handler: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    const mod = await import('@/app/api/dataverse/projects/route')
    handler = mod.GET
  })

  it('returns 401 without token', async () => {
    mockedGetToken.mockResolvedValue(null)
    const res = await handler(req('/api/dataverse/projects'))
    expect(res.status).toBe(401)
  })

  it('returns projects on success', async () => {
    authOk('oid-xyz')
    mockedMapOid.mockResolvedValue('c-mapped')
    const data = [{ id: 'p1', code: 'P001', name: 'Alpha' }]
    stubDs({ getProjects: vi.fn().mockResolvedValue(data) })
    const res = await handler(req('/api/dataverse/projects'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.value).toEqual(data)
  })
})

// ── Time entries ───────────────────────────────────────────────────────
describe('GET /api/dataverse/timeentries', () => {
  let handler: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    const mod = await import('@/app/api/dataverse/timeentries/route')
    handler = mod.GET
  })

  it('returns 401 without token', async () => {
    mockedGetToken.mockResolvedValue(null)
    const res = await handler(req('/api/dataverse/timeentries?from=2025-01-01&to=2025-01-31'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing date range', async () => {
    authOk()
    stubDs()
    const res = await handler(req('/api/dataverse/timeentries'))
    expect(res.status).toBe(400)
  })

  it('returns time entries on success', async () => {
    authOk('oid-user')
    mockedMapOid.mockResolvedValue('c-user')
    const data = [{ id: 'te1', date: '2025-01-15', hours: 8 }]
    stubDs({ getTimeEntries: vi.fn().mockResolvedValue(data) })
    const res = await handler(req('/api/dataverse/timeentries?from=2025-01-01&to=2025-01-31'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.value).toEqual(data)
  })

  it('returns 500 on data source error', async () => {
    authOk()
    stubDs({ getTimeEntries: vi.fn().mockRejectedValue(new Error('DS error')) })
    const res = await handler(req('/api/dataverse/timeentries?from=2025-01-01&to=2025-01-31'))
    expect(res.status).toBe(500)
  })
})
