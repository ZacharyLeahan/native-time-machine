import { describe,it,expect } from 'vitest'
import { defaultDesign,serializeDesign } from '../persistence/design'
import { plantingSummary } from './plantingSummary'
describe('planting summary',()=>{
  it('groups instances without losing centers or treating existing trees as purchases',()=>{
    const design={...defaultDesign,plants:[{id:'a',speciesId:'white-oak',xFt:1,zFt:-4,plantedYear:0},{id:'b',speciesId:'white-oak',xFt:8,zFt:9,plantedYear:0,origin:'existing-lidar' as const,measuredHeightFt:42,measuredWidthFt:30}]}
    const before=serializeDesign(design),young=plantingSummary(design,0),older=plantingSummary(design,40)
    expect(young).toHaveLength(1)
    expect(young[0].plants.map(p=>[p.xFt,p.zFt,p.existing])).toEqual([[1,-4,false],[8,9,true]])
    expect(older[0].plants[0].heightFt).toBeGreaterThan(young[0].plants[0].heightFt)
    expect(young[0].plants[1].heightFt).toBe(42)
    expect(older[0].plants[1].heightFt).toBeCloseTo(45.36)
    expect(serializeDesign(design)).toBe(before)
    expect(plantingSummary({...design,plants:[]},10)).toEqual([])
  })
})
