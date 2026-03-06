import { describe, it, expect } from 'vitest'
import { odataGuid, odataString, odataDate } from '@/lib/odata-sanitizer'

describe('odataGuid', () => {
  it('accepts a valid lowercase GUID', () => {
    expect(odataGuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  })

  it('accepts a valid uppercase GUID', () => {
    expect(odataGuid('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')
  })

  it('rejects a non-GUID string', () => {
    expect(() => odataGuid('not-a-guid')).toThrow('Invalid GUID')
  })

  it('rejects a GUID with injection payload', () => {
    expect(() => odataGuid("a1b2c3d4-e5f6-7890-abcd-ef1234567890' or 1 eq 1")).toThrow('Invalid GUID')
  })

  it('rejects empty string', () => {
    expect(() => odataGuid('')).toThrow('Invalid GUID')
  })
})

describe('odataString', () => {
  it('wraps simple string in single quotes', () => {
    expect(odataString('hello')).toBe("'hello'")
  })

  it('escapes embedded single quotes', () => {
    expect(odataString("it's")).toBe("'it''s'")
  })

  it('handles empty string', () => {
    expect(odataString('')).toBe("''")
  })
})

describe('odataDate', () => {
  it('accepts a valid date', () => {
    expect(odataDate('2024-01-15')).toBe('2024-01-15')
  })

  it('rejects invalid format', () => {
    expect(() => odataDate('15-01-2024')).toThrow('Invalid date')
  })

  it('rejects date with injection', () => {
    expect(() => odataDate("2024-01-15' or 1 eq 1")).toThrow('Invalid date')
  })
})
