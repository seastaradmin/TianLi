import { describe, expect, it } from 'vitest'

import { normalizeApiBase } from '../utils/api'

describe('normalizeApiBase', () => {
  it('defaults to a relative /api base', () => {
    expect(normalizeApiBase()).toBe('/api')
    expect(normalizeApiBase('')).toBe('/api')
    expect(normalizeApiBase('/')).toBe('/api')
  })

  it('keeps explicit api paths stable', () => {
    expect(normalizeApiBase('/api/')).toBe('/api')
    expect(normalizeApiBase('http://127.0.0.1:1420/api/')).toBe('http://127.0.0.1:1420/api')
  })

  it('upgrades bare origins to the api namespace for backward compatibility', () => {
    expect(normalizeApiBase('http://127.0.0.1:1420')).toBe('http://127.0.0.1:1420/api')
    expect(normalizeApiBase('https://example.com/')).toBe('https://example.com/api')
  })
})
