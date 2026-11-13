import { describe,it,expect } from 'vitest'
import { aerialAlignedBoundary,displayBoundary } from './displayBoundary'
import { recordedLot49Boundary } from './recordedLot49'
import { nearestBoundary } from '../simulation/measurements'
describe('aerial boundary registration',()=>{
  it('translates the entire deed shape 14 feet south without scaling or rotating it',()=>{
    const source=JSON.stringify(recordedLot49Boundary)
    for(let i=0;i<recordedLot49Boundary.length;i++){
      const a=recordedLot49Boundary[i],b=recordedLot49Boundary[(i+1)%recordedLot49Boundary.length],shifted=aerialAlignedBoundary[i],next=aerialAlignedBoundary[(i+1)%aerialAlignedBoundary.length]
      expect(shifted.xFt).toBe(a.xFt);expect(shifted.zFt).toBe(a.zFt-14)
      expect(Math.hypot(shifted.xFt-next.xFt,shifted.zFt-next.zFt)).toBeCloseTo(Math.hypot(a.xFt-b.xFt,a.zFt-b.zFt),10)
    }
    expect(JSON.stringify(recordedLot49Boundary)).toBe(source)
  })
  it('uses one boundary source for rendering and ruler endpoints, retaining original comparison views',()=>{
    const aligned=displayBoundary(true,true),original=displayBoundary(true,false),gis=displayBoundary(false,true)
    expect(aligned.points).toBe(aerialAlignedBoundary);expect(original.points).toBe(recordedLot49Boundary);expect(gis.view).toBe('gis')
    const point=aerialAlignedBoundary[40]
    expect(nearestBoundary(point,aligned.points)?.distanceFt).toBeLessThan(1e-8)
    expect(nearestBoundary(point,original.points)?.distanceFt).toBeGreaterThan(5)
  })
})
