import { describe, expect, it } from 'vitest'
import { isInsidePickwickProperty, pickwickProperty } from './pickwickProperty'

describe('Pickwick property geometry',()=>{
  it('matches the recorded public parcel metadata',()=>{
    expect(pickwickProperty.recordedAreaSqFt).toBe(21125)
    expect(pickwickProperty.recordedAcres).toBeCloseTo(.484963)
  })

  it('accepts interior placements and rejects locations beyond the parcel',()=>{
    expect(isInsidePickwickProperty({xFt:0,zFt:0})).toBe(true)
    expect(isInsidePickwickProperty({xFt:110,zFt:0})).toBe(false)
    expect(isInsidePickwickProperty({xFt:0,zFt:-117})).toBe(true)
  })

  it('does not promote unresolved remote stem candidates into the design',()=>{
    expect(pickwickProperty.existingTrees).toHaveLength(0)
  })
})
