import { describe,it,expect } from 'vitest'
import type { PlantInstance } from '../types'
import { arrangePlantingGroup, movePlantingGroup, plantingCoordinates, plantingFrame, type PlantingFrame } from './plantingGroup'
import { aerialAlignedBoundary } from '../data/displayBoundary'
const frame:PlantingFrame={origin:{xFt:0,zFt:0},along:{xFt:1,zFt:0},away:{xFt:0,zFt:1}}
const plants:PlantInstance[]=[{id:'a',speciesId:'white-oak',xFt:1.3,zFt:8.4,plantedYear:0},{id:'b',speciesId:'red-maple',xFt:8.6,zFt:11.2,plantedYear:2},{id:'c',speciesId:'pawpaw',xFt:21.9,zFt:9.1,plantedYear:1}]
describe('boundary-relative planting arrangements',()=>{
  it('chooses a real straight edge, with a unit inward normal and camera-facing right direction',()=>{
    const anchor={xFt:30,zFt:-85},f=plantingFrame(anchor,aerialAlignedBoundary,.4)
    expect(Math.hypot(f.along.xFt,f.along.zFt)).toBeCloseTo(1)
    expect(Math.hypot(f.away.xFt,f.away.zFt)).toBeCloseTo(1)
    expect(f.along.xFt*f.away.xFt+f.along.zFt*f.away.zFt).toBeCloseTo(0)
    expect(f.along.xFt*Math.cos(.4)+f.along.zFt*Math.sin(.4)).toBeGreaterThanOrEqual(0)
    expect(plantingCoordinates(anchor,f).away).toBeGreaterThan(0)
  })
  it('makes a boundary-parallel row at a whole-foot setback without changing along-edge locations',()=>{
    const result=arrangePlantingGroup(plants,frame,'row',()=>10)
    expect(result.map(p=>p.zFt)).toEqual([10,10,10]);expect(result.map(p=>p.xFt)).toEqual(plants.map(p=>p.xFt))
  })
  it('aligns perpendicular to the edge without changing perpendicular spacing',()=>{
    const result=arrangePlantingGroup(plants,frame,'column',()=>10)
    expect(new Set(result.map(p=>p.xFt)).size).toBe(1);expect(result.map(p=>p.zFt)).toEqual(plants.map(p=>p.zFt))
  })
  it('distributes centers on an ordered row using equal whole-foot gaps',()=>{
    const result=arrangePlantingGroup([plants[2],plants[0],plants[1]],frame,'even',()=>10)
    const sorted=[...result].sort((a,b)=>a.xFt-b.xFt)
    expect(sorted[1].xFt-sorted[0].xFt).toBe(10);expect(sorted[2].xFt-sorted[1].xFt).toBe(10)
    expect(result.map(p=>p.id)).toEqual(['c','a','b']);expect(new Set(result.map(p=>p.zFt)).size).toBe(1)
  })
  it('accounts for different mature crowns plus an estimated two-foot clear gap',()=>{
    const widths:Record<string,number>={a:60,b:36,c:18},result=arrangePlantingGroup(plants,frame,'canopy',p=>widths[p.id])
    expect(result[1].xFt-result[0].xFt).toBe(50);expect(result[2].xFt-result[1].xFt).toBe(29)
  })
  it('rounds fractional boundary setbacks before a one-foot nudge and preserves group shape',()=>{
    const result=movePlantingGroup(plants,frame,0,1,true)
    expect(Math.min(...result.map(p=>p.zFt))).toBeCloseTo(9)
    expect(result[0].xFt).toBeCloseTo(1)
    for(let i=1;i<plants.length;i++)expect(Math.hypot(result[i].xFt-result[0].xFt,result[i].zFt-result[0].zFt)).toBeCloseTo(Math.hypot(plants[i].xFt-plants[0].xFt,plants[i].zFt-plants[0].zFt))
    const again=movePlantingGroup(result,frame,0,1,true)
    expect(Math.min(...again.map(p=>p.zFt))).toBeCloseTo(10)
  })
  it('snaps in an oblique real boundary frame rather than rounding unrelated world X/Y',()=>{
    const f=plantingFrame({xFt:30,zFt:-85},aerialAlignedBoundary)
    const result=movePlantingGroup(plants,f,1,0,true),coords=result.map(p=>plantingCoordinates(p,f))
    expect(coords[0].along).toBeCloseTo(Math.round(plantingCoordinates(plants[0],f).along)+1)
    expect(Math.min(...coords.map(p=>p.away))).toBeCloseTo(Math.round(Math.min(...plants.map(p=>plantingCoordinates(p,f).away))))
  })
  it('never changes source objects, species, age, or metadata',()=>{
    const before=JSON.stringify(plants)
    const result=arrangePlantingGroup(plants,frame,'even',()=>10)
    expect(JSON.stringify(plants)).toBe(before)
    result.forEach((p,i)=>expect({...p,xFt:plants[i].xFt,zFt:plants[i].zFt}).toEqual(plants[i]))
  })
})
