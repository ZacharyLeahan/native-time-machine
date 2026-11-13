import { describe,expect,it } from 'vitest'
import { groundHeight,surface } from './surface'
import { pickwickProperty } from '../data/pickwickProperty'
describe('measured site surface',()=>{
  it('has a complete finite terrain grid and interpolates stored nodes',()=>{
    const {size,min,step,heights}=surface.grid
    expect(heights).toHaveLength(size*size)
    expect(heights.every(Number.isFinite)).toBe(true)
    for(const i of [0,100,5555,heights.length-1]){
      expect(groundHeight(min+(i%size)*step,min+Math.floor(i/size)*step)).toBeCloseTo(heights[i],6)
    }
  })
  it('retains broad, supported roof planes and valid mesh indices',()=>{
    expect(surface.roof.sampleCount).toBeGreaterThan(1000)
    expect(surface.roof.planes.length).toBeGreaterThanOrEqual(2)
    for(const plane of surface.roof.planes){expect(plane.support).toBeGreaterThan(40);expect(plane.rmseFt).toBeLessThan(.25)}
    expect(surface.roof.indices.every(i=>i>=0&&i<surface.roof.vertices.length)).toBe(true)
    for(const [x,z,y] of surface.roof.vertices)expect(y-groundHeight(x,z)).toBeGreaterThan(6)
    for(const p of pickwickProperty.boundary)expect(Number.isFinite(groundHeight(p.xFt,p.zFt))).toBe(true)
  })
})
