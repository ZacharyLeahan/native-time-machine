import { describe,expect,it } from 'vitest'
import { closestPointOnSegment, measurePlacement, measurementSubject, nearestBoundary, nearestPlant } from './measurements'
import { recordedLot49Boundary } from '../data/recordedLot49'
import { pickwickProperty } from '../data/pickwickProperty'
import { defaultDesign,serializeDesign } from '../persistence/design'

const square=[{xFt:0,zFt:0},{xFt:10,zFt:0},{xFt:10,zFt:10},{xFt:0,zFt:10}]
const tree=(id:string,xFt:number,zFt:number)=>({id,speciesId:'white-oak',xFt,zFt,plantedYear:0})
describe('horizontal placement measurements',()=>{
  it('finds the perpendicular foot on an edge rather than a boundary vertex',()=>{
    const result=nearestBoundary({xFt:3,zFt:4},square)!
    expect(result.point).toEqual({xFt:0,zFt:4});expect(result.distanceFt).toBe(3);expect(result.outside).toBe(false)
  })
  it('handles outside points, boundary points, corners and a closing duplicate',()=>{
    expect(nearestBoundary({xFt:-3,zFt:-4},square)).toEqual({point:{xFt:0,zFt:0},distanceFt:5,outside:true})
    expect(nearestBoundary({xFt:0,zFt:4},[...square,square[0]])?.outside).toBe(false)
    expect(nearestBoundary({xFt:0,zFt:4},square)?.distanceFt).toBe(0)
  })
  it('projects onto slanted edges and handles zero-length segments',()=>{
    expect(closestPointOnSegment({xFt:3,zFt:7},{xFt:0,zFt:0},{xFt:10,zFt:10})).toEqual({xFt:5,zFt:5})
    expect(closestPointOnSegment({xFt:3,zFt:7},square[0],square[0])).toEqual(square[0])
    expect(nearestBoundary(square[0],[])).toBeNull()
  })
  it('excludes only the moving plant and measures center-to-center, including coincident trunks',()=>{
    const plants=[tree('self',0,0),tree('near',3,4),tree('far',10,10)]
    expect(nearestPlant(plants[0],plants,'self')).toEqual({plant:plants[1],distanceFt:5})
    expect(nearestPlant(plants[0],[plants[0]],'self')).toBeNull()
    expect(nearestPlant(plants[0],[...plants,tree('coincident',0,0)],'self')?.distanceFt).toBe(0)
  })
  it('tracks drag/carry coordinates and switches the nearest neighbor without touching the design',()=>{
    const plants=[tree('self',2,2),tree('left',1,2),tree('right',9,2)],design={...defaultDesign,plants},before=serializeDesign(design)
    const carried={id:'self',xFt:8,zFt:2}
    const result=measurePlacement(carried,plants,square)
    expect(result.neighbor?.plant.id).toBe('right');expect(result.neighbor?.distanceFt).toBe(1)
    expect(result.boundary?.distanceFt).toBe(2)
    expect(serializeDesign(design)).toBe(before)
  })
  it('uses selection in Plan/Garden, only a preview in Walk, and nothing in Spectator',()=>{
    const plant=tree('self',2,2),preview={id:'walk-preview',speciesId:'red-maple',xFt:8,zFt:2}
    expect(measurementSubject([plant],plant.id,null,'garden')).toBe(plant)
    expect(measurementSubject([plant],plant.id,null,'planner')).toBe(plant)
    expect(measurementSubject([plant],plant.id,null,'walk')).toBeNull()
    expect(measurementSubject([plant],plant.id,preview,'walk')).toBe(preview)
    expect(measurementSubject([plant],plant.id,preview,'spectator')).toBeNull()
    expect(measurementSubject([plant],'missing',null,'planner')).toBeNull()
  })
  it('measures the explicitly chosen real boundary, including the recorded frontage curve',()=>{
    const point=recordedLot49Boundary[30]
    expect(nearestBoundary(point,recordedLot49Boundary)?.distanceFt).toBeLessThan(1e-8)
    expect(nearestBoundary(point,pickwickProperty.boundary)?.distanceFt).toBeGreaterThan(.1)
  })
})
