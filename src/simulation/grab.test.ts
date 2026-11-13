import { describe,it,expect } from 'vitest'
import { captureGrab, grabbedPoint } from './grab'
describe('camera-relative grab',()=>{
  it('round trips arbitrary pickup positions, camera headings and pitches without teleporting',()=>{
    for(const yaw of [0,.4,-1.7,Math.PI])for(const pitch of [-1,-.2,0,.8]){
      const pose={xFt:10,zFt:-45,heightFt:8,yaw,pitch},point={xFt:31,zFt:-20,heightFt:1.5}
      const result=grabbedPoint(captureGrab(point,pose),pose)
      expect(result.xFt).toBeCloseTo(point.xFt,10);expect(result.zFt).toBeCloseTo(point.zFt,10);expect(result.heightFt).toBeCloseTo(point.heightFt,10)
    }
  })
  it('follows player translation, horizontal look, and upward/downward look',()=>{
    const pose={xFt:0,zFt:0,heightFt:5.6,yaw:0,pitch:0},point={xFt:0,zFt:10,heightFt:.8},offset=captureGrab(point,pose)
    const translated=grabbedPoint(offset,{...pose,xFt:7,zFt:3})
    expect(translated.xFt).toBe(7);expect(translated.zFt).toBe(13);expect(translated.heightFt).toBeCloseTo(point.heightFt)
    const turned=grabbedPoint(offset,{...pose,yaw:Math.PI/2})
    expect(turned.xFt).toBeCloseTo(-10);expect(turned.zFt).toBeCloseTo(0)
    expect(grabbedPoint(offset,{...pose,pitch:.4}).heightFt).toBeGreaterThan(point.heightFt)
    expect(grabbedPoint(offset,{...pose,pitch:-.4}).heightFt).toBeLessThan(point.heightFt)
  })
})
