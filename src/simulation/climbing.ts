import { Box3,Raycaster,Vector3,type Object3D } from 'three'
export interface ClimbTarget {x:number;y:number;z:number;label:string}
export function climbRoot(object:Object3D):Object3D|null {
  for(let node:Object3D|null=object;node;node=node.parent)if(node.userData.climbable||node.userData.canClimb)return node
  return null
}
export function topSurface(objects:Object3D[],x:number,z:number,ceiling=1000):ClimbTarget|null {
  const ray=new Raycaster(new Vector3(x,ceiling,z),new Vector3(0,-1,0),0,2000)
  const climbables=new Set<Object3D>()
  objects.forEach(object=>object.traverse(node=>{if(node.userData.climbable||node.userData.canClimb)climbables.add(node)}))
  for(const hit of ray.intersectObjects([...climbables],true)){
    const root=climbRoot(hit.object)
    if(root)return {x,y:hit.point.y,z,label:root.userData.climbable?'house':'tree'}
  }
  return null
}
export function findClimbTarget(objects:Object3D[],x:number,z:number,feet:number,yaw:number):ClimbTarget|null {
  const roots=new Set<Object3D>()
  objects.forEach(object=>object.traverse(node=>{if(node.userData.climbable||node.userData.canClimb)roots.add(node)}))
  let best:ClimbTarget|null=null,bestDistance=Infinity
  for(const root of roots){
    if(root.userData.plantId==='walk-preview')continue
    const box=new Box3().setFromObject(root),center=box.getCenter(new Vector3())
    let tx:number,tz:number,distance:number
    if(root.userData.plantId){
      // Approach a trunk, rather than grabbing a crown from across the yard.
      distance=Math.hypot(x-root.position.x,z-root.position.z)
      if(distance>6)continue
      tx=root.position.x;tz=root.position.z
    }else{
      const edgeX=Math.max(box.min.x,Math.min(box.max.x,x)),edgeZ=Math.max(box.min.z,Math.min(box.max.z,z))
      distance=Math.hypot(x-edgeX,z-edgeZ)
      if(distance>5.5)continue
      const dx=center.x-edgeX,dz=center.z-edgeZ,length=Math.hypot(dx,dz)||1
      tx=edgeX+dx/length*4;tz=edgeZ+dz/length*4
    }
    const dx=tx-x,dz=tz-z,length=Math.hypot(dx,dz)||1
    if((-Math.sin(yaw)*dx-Math.cos(yaw)*dz)/length<.25)continue
    const target=topSurface([root],tx,tz)
    if(!target||target.y<feet+1||distance>=bestDistance)continue
    best=target;bestDistance=distance
  }
  return best
}
export function climbPosition(start:ClimbTarget,end:ClimbTarget,progress:number){
  const p=Math.max(0,Math.min(1,progress)),ease=(t:number)=>t*t*(3-2*t)
  const vertical=ease(Math.min(1,p/.75)),horizontal=ease(Math.max(0,(p-.65)/.35))
  return {x:start.x+(end.x-start.x)*horizontal,y:start.y+(end.y-start.y)*vertical,z:start.z+(end.z-start.z)*horizontal}
}
