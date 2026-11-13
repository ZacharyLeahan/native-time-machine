import type { PlantInstance } from '../types'
import type { YardPoint } from './coordinates'
import { closestPointOnSegment } from './measurements'

export interface PlantingFrame {origin:YardPoint;along:YardPoint;away:YardPoint}
export type ArrangeAction='row'|'column'|'even'|'canopy'|'snap'|'cancel'
export const arrangeItems:{label:string;action:ArrangeAction}[]=[{label:'Boundary row',action:'row'},{label:'Perpendicular row',action:'column'},{label:'Even spacing',action:'even'},{label:'Mature canopy room',action:'canopy'},{label:'Whole-foot setback',action:'snap'},{label:'Cancel move',action:'cancel'}]
export function plantingFrame(anchor:YardPoint,boundary:readonly YardPoint[],yaw=0):PlantingFrame {
  const center={xFt:boundary.reduce((n,p)=>n+p.xFt,0)/boundary.length,zFt:boundary.reduce((n,p)=>n+p.zFt,0)/boundary.length}
  const edges=boundary.map((a,i)=>({a,b:boundary[(i+1)%boundary.length]})).filter(({a,b})=>Math.hypot(b.xFt-a.xFt,b.zFt-a.zFt)>40)
  let best=edges[0],distance=Infinity
  for(const edge of edges){const p=closestPointOnSegment(anchor,edge.a,edge.b),d=Math.hypot(p.xFt-anchor.xFt,p.zFt-anchor.zFt);if(d<distance){distance=d;best=edge}}
  if(!best)return {origin:{xFt:0,zFt:0},along:{xFt:1,zFt:0},away:{xFt:0,zFt:1}}
  let {a,b}=best
  if((b.xFt-a.xFt)*Math.cos(yaw)+(b.zFt-a.zFt)*Math.sin(yaw)<0)[a,b]=[b,a]
  const length=Math.hypot(b.xFt-a.xFt,b.zFt-a.zFt),along={xFt:(b.xFt-a.xFt)/length,zFt:(b.zFt-a.zFt)/length}
  const away={xFt:-along.zFt,zFt:along.xFt}
  if((center.xFt-a.xFt)*away.xFt+(center.zFt-a.zFt)*away.zFt<0){away.xFt*=-1;away.zFt*=-1}
  return {origin:{...a},along,away}
}
export function plantingCoordinates(point:YardPoint,frame:PlantingFrame){
  const x=point.xFt-frame.origin.xFt,z=point.zFt-frame.origin.zFt
  return {along:x*frame.along.xFt+z*frame.along.zFt,away:x*frame.away.xFt+z*frame.away.zFt}
}
function at(plant:PlantInstance,along:number,away:number,frame:PlantingFrame):PlantInstance {
  return {...plant,xFt:frame.origin.xFt+along*frame.along.xFt+away*frame.away.xFt,zFt:frame.origin.zFt+along*frame.along.zFt+away*frame.away.zFt}
}
export function movePlantingGroup(plants:readonly PlantInstance[],frame:PlantingFrame,along:number,away:number,snap=false){
  if(!plants.length)return []
  const anchor=plantingCoordinates(plants[0],frame),setback=Math.min(...plants.map(p=>plantingCoordinates(p,frame).away))
  const dx=along+(snap?Math.round(anchor.along)-anchor.along:0),dy=away+(snap?Math.round(setback)-setback:0)
  return plants.map(p=>{const q=plantingCoordinates(p,frame);return at(p,q.along+dx,q.away+dy,frame)})
}
export function arrangePlantingGroup(plants:readonly PlantInstance[],frame:PlantingFrame,action:Exclude<ArrangeAction,'cancel'>,widthFor:(p:PlantInstance)=>number){
  if(!plants.length)return []
  if(action==='snap')return movePlantingGroup(plants,frame,0,0,true)
  const sorted=plants.map(p=>({p,...plantingCoordinates(p,frame)})).sort((a,b)=>a.along-b.along||a.p.id.localeCompare(b.p.id))
  const center=sorted.reduce((n,p)=>n+p.along,0)/sorted.length,setback=Math.round(sorted.reduce((n,p)=>n+p.away,0)/sorted.length)
  if(action==='row')return plants.map(p=>at(p,plantingCoordinates(p,frame).along,setback,frame))
  if(action==='column')return plants.map(p=>at(p,Math.round(center),plantingCoordinates(p,frame).away,frame))
  const offsets=[0],spacing=Math.max(1,Math.round((sorted.at(-1)!.along-sorted[0].along)/Math.max(1,sorted.length-1)))
  for(let i=1;i<sorted.length;i++)offsets.push(offsets[i-1]+(action==='canopy'?Math.ceil((widthFor(sorted[i-1].p)+widthFor(sorted[i].p))/2+2):spacing))
  const start=Math.round(center-(offsets[0]+offsets.at(-1)!)/2)
  const moved=new Map(sorted.map(({p},i)=>[p.id,at(p,start+offsets[i],setback,frame)]))
  return plants.map(p=>moved.get(p.id)!)
}
