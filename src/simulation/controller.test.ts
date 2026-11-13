import { describe,it,expect } from 'vitest'
import { Group,Mesh,BoxGeometry,MeshBasicMaterial,Raycaster,Vector3 } from 'three'
import { aimedPlant,buttonEdges,wheelSector } from './controller'
import { lookStick } from './walkNavigation'
describe('controller interaction pipeline',()=>{
  it('does not fire held buttons on connect or repeat while held',()=>{
    expect(buttonEdges([true,true],null)).toEqual([false,false])
    expect(buttonEdges([true,true],[true,true])).toEqual([false,false])
    expect(buttonEdges([true,false],[false,false])).toEqual([true,false])
  })
  it('selects six wheel directions and cancels in the neutral center',()=>{
    expect(wheelSector(.1,-.1)).toBeNull()
    for(let i=0;i<6;i++)expect(wheelSector(Math.sin(i*Math.PI/3),-Math.cos(i*Math.PI/3))).toBe(i)
  })
  it('stops aim on the exact frame the stick returns to neutral at varied frame rates',()=>{
    for(const fps of [30,60,144]){
      let yaw=0
      for(let i=0;i<fps;i++)yaw+=lookStick(.8)*2.1/fps
      const stopped=yaw
      for(let i=0;i<fps*5;i++)yaw+=lookStick(Math.sin(i)*.24)*2.1/fps
      expect(yaw).toBe(stopped)
    }
  })
  it('picks a real nested tree mesh and cannot pick through the house',()=>{
    const geometry=new BoxGeometry(2,2,2),material=new MeshBasicMaterial()
    const tree=new Group();tree.userData.plantId='tree';tree.position.z=-10
    tree.add(new Mesh(geometry,material));tree.updateMatrixWorld(true)
    const house=new Mesh(geometry,material);house.position.z=-5;house.updateMatrixWorld(true)
    const ray=new Raycaster(new Vector3(0,0,0),new Vector3(0,0,-1),0,65)
    expect(aimedPlant(ray.intersectObjects([tree],true))).toBe('tree')
    expect(aimedPlant(ray.intersectObjects([tree,house],true))).toBeNull()
    geometry.dispose();material.dispose()
  })
})
