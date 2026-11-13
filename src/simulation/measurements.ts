import type { PlantInstance } from '../types'

export interface MeasurementPoint { xFt:number; zFt:number }
export interface CarryPoint extends MeasurementPoint { id:string; speciesId?:string }

export function closestPointOnSegment(point:MeasurementPoint,a:MeasurementPoint,b:MeasurementPoint):MeasurementPoint {
  const dx=b.xFt-a.xFt,dz=b.zFt-a.zFt,lengthSquared=dx*dx+dz*dz
  const t=lengthSquared===0?0:Math.max(0,Math.min(1,((point.xFt-a.xFt)*dx+(point.zFt-a.zFt)*dz)/lengthSquared))
  return {xFt:a.xFt+t*dx,zFt:a.zFt+t*dz}
}
export function nearestBoundary(point:MeasurementPoint,boundary:readonly MeasurementPoint[]) {
  if(boundary.length<2)return null
  let best: {point:MeasurementPoint;distanceFt:number;outside:boolean}|null=null,inside=false
  for(let i=0,j=boundary.length-1;i<boundary.length;j=i++){
    const a=boundary[j],b=boundary[i],candidate=closestPointOnSegment(point,a,b)
    const distanceFt=Math.hypot(candidate.xFt-point.xFt,candidate.zFt-point.zFt)
    if(!best||distanceFt<best.distanceFt)best={point:candidate,distanceFt,outside:false}
    if((a.zFt>point.zFt)!==(b.zFt>point.zFt)&&point.xFt<(b.xFt-a.xFt)*(point.zFt-a.zFt)/(b.zFt-a.zFt)+a.xFt)inside=!inside
  }
  return best?{...best,outside:!inside&&best.distanceFt>1e-7}:null
}
export function nearestPlant(point:MeasurementPoint,plants:readonly PlantInstance[],excludeId:string) {
  let best:{plant:PlantInstance;distanceFt:number}|null=null
  for(const plant of plants){
    if(plant.id===excludeId)continue
    const distanceFt=Math.hypot(plant.xFt-point.xFt,plant.zFt-point.zFt)
    if(!best||distanceFt<best.distanceFt)best={plant,distanceFt}
  }
  return best
}
export function measurementSubject(plants:readonly PlantInstance[],selectedId:string|null,carry:CarryPoint|null,mode:string,marked:readonly string[]=[],targetId:string|null=null):CarryPoint|null {
  if(mode==='spectator')return null
  if(mode==='walk'){
    if(carry)return carry
    const id=targetId&&marked.includes(targetId)?targetId:selectedId&&marked.includes(selectedId)?selectedId:marked.at(-1)
    return plants.find(plant=>plant.id===id)??null
  }
  return plants.find(plant=>plant.id===selectedId)??null
}
export function measurePlacement(subject:CarryPoint,plants:readonly PlantInstance[],boundary:readonly MeasurementPoint[]) {
  return {subject,boundary:nearestBoundary(subject,boundary),neighbor:nearestPlant(subject,plants,subject.id)}
}
export function distanceLabel(feet:number) {return `≈ ${feet.toFixed(1)} ft`}
