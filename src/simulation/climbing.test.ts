import { describe,it,expect } from 'vitest'
import { Group,Mesh,BoxGeometry,MeshBasicMaterial } from 'three'
import { climbPosition,findClimbTarget,topSurface } from './climbing'
function fixture(tree=false){
  const root=new Group();root.userData=tree?{canClimb:true,plantId:'tree'}:{climbable:'house'}
  root.position.set(0,0,-10)
  const geometry=new BoxGeometry(10,20,10),material=new MeshBasicMaterial(),mesh=new Mesh(geometry,material)
  mesh.position.y=10;root.add(mesh);root.updateMatrixWorld(true)
  return {root,dispose:()=>{geometry.dispose();material.dispose()}}
}
describe('jump-assisted climbing',()=>{
  it('finds a nearby facing roof and rejects distant or behind-camera targets',()=>{
    const {root,dispose}=fixture()
    const target=findClimbTarget([root],0,-2,0,0)
    expect(target?.y).toBeCloseTo(20)
    expect(findClimbTarget([root],0,20,0,0)).toBeNull()
    expect(findClimbTarget([root],0,-2,0,Math.PI)).toBeNull()
    dispose()
  })
  it('climbs a planted tree only near the trunk and ignores previews',()=>{
    const {root,dispose}=fixture(true)
    expect(findClimbTarget([root],0,-5,0,0)?.label).toBe('tree')
    expect(findClimbTarget([root],0,0,0,0)).toBeNull()
    root.userData.plantId='walk-preview'
    expect(findClimbTarget([root],0,-5,0,0)).toBeNull()
    dispose()
  })
  it('pulls upward before moving inward and finishes exactly at the top',()=>{
    const start={x:0,y:0,z:0,label:'start'},end={x:4,y:25,z:-4,label:'house'}
    expect(climbPosition(start,end,0)).toEqual({x:0,y:0,z:0})
    expect(climbPosition(start,end,.5).x).toBe(0)
    expect(climbPosition(start,end,.5).y).toBeGreaterThan(0)
    expect(climbPosition(start,end,1)).toEqual({x:4,y:25,z:-4})
  })
  it('supports standing on top and does not snap a walker underneath onto the roof',()=>{
    const {root,dispose}=fixture()
    expect(topSurface([root],0,-10,21)?.y).toBeCloseTo(20)
    expect(topSurface([root],0,-10,5)).toBeNull()
    expect(topSurface([root],20,-10,21)).toBeNull()
    dispose()
  })
})
