import type { Intersection, Object3D } from 'three'
export function aimedPlant(hits:readonly Intersection[]):string|null {
  for(const hit of hits){
    let object:Object3D|null=hit.object
    while(object&&!object.userData.plantId)object=object.parent
    if(object)return object.userData.plantId as string
    if(hit.object.type==='Mesh')return null
  }
  return null
}
export const equipmentItems=[
  {label:'White oak',speciesId:'white-oak'}, {label:'Red maple',speciesId:'red-maple'},
  {label:'Eastern redbud',speciesId:'eastern-redbud'}, {label:'Serviceberry',speciesId:'serviceberry'},
  {label:'Move plants',speciesId:null}, {label:'Cancel',speciesId:null},
] as const
export function wheelSector(x:number,y:number):number|null {
  if(Math.hypot(x,y)<.45)return null
  const angle=(Math.atan2(x,-y)+Math.PI*2)%(Math.PI*2)
  return Math.round(angle/(Math.PI*2/equipmentItems.length))%equipmentItems.length
}
export function buttonEdges(current:readonly boolean[],previous:readonly boolean[]|null):boolean[]{
  return current.map((value,index)=>Boolean(previous&&value&&!previous[index]))
}
