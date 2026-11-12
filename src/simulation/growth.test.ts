import { describe, expect, it } from 'vitest'
import { catalogById } from '../data/catalog'
import { dimensionsAtYear, growthProgress } from './growth'

describe('growth simulation', () => {
  const oak = catalogById.get('white-oak')!
  const mistflower = catalogById.get('blue-mistflower')!

  it('never grows before planting and reaches maturity', () => {
    expect(growthProgress(-5, oak)).toBe(0)
    expect(growthProgress(50, oak)).toBe(1)
    expect(dimensionsAtYear(oak, 50).widthFt).toBe(70)
  })

  it('is monotonic over the simulation window', () => {
    const values = [0, 1, 5, 10, 25, 50].map((year) => growthProgress(year, oak))
    expect(values).toEqual([...values].sort((a, b) => a - b))
  })

  it('uses species-specific curves rather than a shared scale', () => {
    expect(growthProgress(2, mistflower)).toBe(1)
    expect(growthProgress(2, oak)).toBeLessThan(.1)
  })
})
