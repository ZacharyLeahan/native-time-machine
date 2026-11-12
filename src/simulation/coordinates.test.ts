import { describe, expect, it } from 'vitest'
import { clampToYard, normalizedToYard, siteToWorld, worldToSite, yardToNormalized } from './coordinates'

describe('property coordinate transforms', () => {
  it('round-trips real-world feet through normalized coordinates', () => {
    const point = { xFt: 18.25, zFt: -31.5 }
    const result = normalizedToYard(yardToNormalized(point, 100, 80), 100, 80)
    expect(result.xFt).toBeCloseTo(point.xFt)
    expect(result.zFt).toBeCloseTo(point.zFt)
  })

  it('clamps positions inside the property boundary', () => {
    expect(clampToYard({ xFt: 100, zFt: -100 }, 100, 80, 2)).toEqual({ xFt: 48, zFt: -38 })
  })

  it('converts north-positive site coordinates to Three.js world coordinates', () => {
    const site={xFt:24,zFt:61}
    const world=siteToWorld(site)
    expect(world).toEqual({x:24,z:-61})
    expect(worldToSite(world)).toEqual(site)
  })
})
