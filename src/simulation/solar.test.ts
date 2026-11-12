import { describe, expect, it } from 'vitest'
import { calculateSolarSnapshot, timezoneOffsetHours, zonedDateTimeToUtc } from './solar'

describe('solar position',()=>{
  it('uses date-aware Eastern Time offsets',()=>{
    expect(timezoneOffsetHours(new Date('2026-01-15T17:00:00Z'))).toBe(-5)
    expect(timezoneOffsetHours(new Date('2026-07-15T16:00:00Z'))).toBe(-4)
  })

  it('converts local wall time to the correct UTC instant',()=>{
    expect(zonedDateTimeToUtc('2026-07-15',720).toISOString()).toBe('2026-07-15T16:00:00.000Z')
  })

  it('places the summer-solstice sun high and near south at solar noon',()=>{
    const day=calculateSolarSnapshot('2026-06-21',720)
    const noon=calculateSolarSnapshot('2026-06-21',day.solarNoonMinutes)
    expect(noon.altitudeDeg).toBeGreaterThan(72)
    expect(noon.altitudeDeg).toBeLessThan(75)
    expect(noon.azimuthDeg).toBeCloseTo(180,0)
    expect(noon.sunriseMinutes).toBeLessThan(noon.solarNoonMinutes)
    expect(noon.solarNoonMinutes).toBeLessThan(noon.sunsetMinutes)
  })

  it('returns a normalized Three.js direction vector',()=>{
    const snapshot=calculateSolarSnapshot('2026-09-22',600)
    const length=Math.hypot(...snapshot.worldDirection)
    expect(length).toBeCloseTo(1,8)
  })
})
