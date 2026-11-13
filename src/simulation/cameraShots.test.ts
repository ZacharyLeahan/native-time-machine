import { describe,it,expect } from 'vitest'
import { cameraShot } from './cameraShots'
describe('camera framing',()=>{
  it('keeps camera coordinates finite during zero-size resize transitions',()=>{
    for(const aspect of [0,NaN,Infinity,-1]){
      const shot=cameraShot('front',undefined,aspect)
      expect(shot.position.every(Number.isFinite)).toBe(true)
    }
  })
  it('places opposite views on opposite sides with a shared target',()=>{
    const front=cameraShot('front'),back=cameraShot('back'),left=cameraShot('left'),right=cameraShot('right')
    expect(front.position[2]).toBeGreaterThan(0);expect(back.position[2]).toBeLessThan(0)
    expect(left.position[0]).toBeLessThan(0);expect(right.position[0]).toBeGreaterThan(0)
    expect(front.target).toEqual(back.target)
  })
  it('centers selected plants at their world location and fits taller trees and narrow viewports',()=>{
    const focus={x:40,y:3,z:-25,height:80,width:60}
    const shot=cameraShot('selected',focus),narrow=cameraShot('selected',focus,.5)
    expect(shot.target).toEqual([40,43,-25])
    expect(Math.hypot(...narrow.position.map((v,i)=>v-narrow.target[i]))).toBeGreaterThan(Math.hypot(...shot.position.map((v,i)=>v-shot.target[i])))
    expect(cameraShot('selected',{...focus,height:10,width:6}).position[1]).toBeLessThan(shot.position[1])
  })
})
