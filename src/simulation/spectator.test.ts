import { describe,it,expect } from 'vitest'
import { flightDelta } from './spectator'
describe('spectator free flight',()=>{
  it('ascends vertically regardless of camera pitch or yaw',()=>{
    for(const pitch of [-1,0,1])for(const yaw of [-2,0,2]){
      for(const up of [-1,1]){const d=flightDelta(0,0,up,yaw,pitch,10);expect(d.x).toBeCloseTo(0);expect(d.z).toBeCloseTo(0);expect(d.y).toBe(up*10)}
    }
  })
  it('flies toward the look direction and strafes independently',()=>{
    expect(flightDelta(1,0,0,0,0,10).z).toBe(-10)
    expect(flightDelta(1,0,0,0,Math.PI/4,10).y).toBeCloseTo(Math.SQRT1_2*10)
    expect(flightDelta(0,1,0,0,0,10).x).toBe(10)
    const stopped=flightDelta(0,0,0,2,1,10);expect(Math.hypot(stopped.x,stopped.y,stopped.z)).toBe(0)
  })
  it('caps diagonal speed including pitched movement plus ascent',()=>{
    for(const pitch of [-1,0,1]){
      const d=flightDelta(1,1,1,.7,pitch,10)
      expect(Math.hypot(d.x,d.y,d.z)).toBeLessThanOrEqual(10.000001)
    }
  })
})
