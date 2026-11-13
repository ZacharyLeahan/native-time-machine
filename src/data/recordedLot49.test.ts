import { describe,it,expect } from 'vitest'
import { lot49Plan, recordedLot49Boundary as p } from './recordedLot49'
const distance=(a:typeof p[number],b:typeof p[number])=>Math.hypot(a.xFt-b.xFt,a.zFt-b.zFt)
describe('recorded Lot 49 reconstruction',()=>{
  it('uses deed-verified bearings and keeps historical orientation separate from the GIS anchor',()=>{
    expect(lot49Plan.frontageBearingDeg+lot49Plan.sideBearingWestDeg).toBeCloseTo(90,8)
    expect(lot49Plan.frontageBearingDeg).toBeCloseTo(69+40/60,8)
    const rear={x:p[93].xFt-p[92].xFt,z:p[93].zFt-p[92].zFt}
    expect(rear.x/rear.z).toBeCloseTo((18.763+93.853)/(87.547-22.328),8)
    expect((p[92].xFt+p[93].xFt)/2).toBeCloseTo((-93.853+18.763)/2,8)
  })
  it('matches the four straight dimensions',()=>{
    expect(distance(p[0],p[1])).toBeCloseTo(105,6)
    expect(distance(p[91],p[92])).toBeCloseTo(150,6)
    expect(distance(p[92],p[93])).toBeCloseTo(130,6)
    expect(distance(p[93],p[0])).toBeCloseTo(175,6)
  })
  it('reconstructs a 39.27 ft quarter-circle arc',()=>{
    let length=0;for(let i=1;i<91;i++)length+=distance(p[i],p[i+1])
    expect(length).toBeCloseTo(Math.PI*25/2,2)
  })
})
