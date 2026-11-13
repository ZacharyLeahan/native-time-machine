import { describe,it,expect } from 'vitest'
import { planFraming } from './planFraming'
import { recordedLot49Boundary } from '../data/recordedLot49'
import { aerialAlignedBoundary } from '../data/displayBoundary'
describe('Plan parcel framing',()=>{
  it('fits the entire real parcel between menus and bottom controls on phones and desktops',()=>{
    for(const boundary of [recordedLot49Boundary,aerialAlignedBoundary])for(const [width,height] of [[305,300],[305,398],[375,490],[326,636],[458,588],[786,668]]){
      const frame=planFraming(boundary,width,height)
      for(const point of boundary){
        const x=width/2+(point.xFt-frame.xFt)*frame.zoom,y=height/2-(point.zFt-frame.zFt)*frame.zoom
        expect(x).toBeGreaterThanOrEqual(23.9);expect(x).toBeLessThanOrEqual(width-23.9)
        expect(y).toBeGreaterThanOrEqual(65);expect(y).toBeLessThanOrEqual(height-73)
      }
    }
  })
  it('stays finite during resize transitions',()=>{
    for(const size of [0,NaN,Infinity,-1])expect(Object.values(planFraming(recordedLot49Boundary,size,size)).every(Number.isFinite)).toBe(true)
  })
})
