import { describe,expect,it } from 'vitest'
import { applyStickDeadzone, lookStick, jumpStep, isPointInsidePolygon, isWalkPositionAllowed, walkDelta } from './walkNavigation'

describe('walk navigation',()=>{
  it('holds aim exactly still throughout neutral stick jitter',()=>{
    let pitch=0
    for(let i=0;i<600;i++)pitch+=lookStick(Math.sin(i)*.24)*1.7/60
    expect(pitch).toBe(0)
    expect(lookStick(.5)).toBeGreaterThan(0)
    expect(lookStick(-1)).toBe(-1)
    expect(lookStick(1)).toBe(1)
    expect(lookStick(.32,.35)).toBe(0)
    expect(lookStick(Number.NaN)).toBe(0)
  })
  it('jumps modestly, cannot jump again in midair, and lands on the ground',()=>{
    let state={height:0,velocity:0},peak=0
    for(let i=0;i<120;i++){
      state=jumpStep(state.height,state.velocity,1/60,i===0||i===10)
      peak=Math.max(peak,state.height)
    }
    expect(peak).toBeGreaterThan(1.4)
    expect(peak).toBeLessThan(1.8)
    expect(state).toEqual({height:0,velocity:0})
  })
  it('filters controller drift and rescales deliberate stick input',()=>{
    expect(applyStickDeadzone(.08)).toBe(0)
    expect(applyStickDeadzone(-.14)).toBe(0)
    expect(applyStickDeadzone(1)).toBe(1)
    expect(applyStickDeadzone(-1)).toBe(-1)
  })

  it('maps forward and strafe movement to the camera yaw',()=>{
    expect(walkDelta(1,0,0,10)).toEqual({x:0,z:-10})
    const east=walkDelta(1,0,-Math.PI/2,10)
    expect(east.x).toBeCloseTo(10)
    expect(east.z).toBeCloseTo(0)
    expect(Math.hypot(walkDelta(1,1,0,10).x,walkDelta(1,1,0,10).z)).toBeCloseTo(10)
  })

  it('keeps the walker in the parcel and outside the house and trunks',()=>{
    expect(isWalkPositionAllowed(0,95)).toBe(true)
    expect(isWalkPositionAllowed(200,0)).toBe(false)
    expect(isWalkPositionAllowed(5,40)).toBe(false)
    expect(isWalkPositionAllowed(0,95,[{x:0,z:95,radius:2}])).toBe(false)
  })

  it('handles generic polygon containment',()=>{
    const square=[{xFt:0,zFt:0},{xFt:10,zFt:0},{xFt:10,zFt:10},{xFt:0,zFt:10}]
    expect(isPointInsidePolygon({xFt:5,zFt:5},square)).toBe(true)
    expect(isPointInsidePolygon({xFt:12,zFt:5},square)).toBe(false)
  })
})
