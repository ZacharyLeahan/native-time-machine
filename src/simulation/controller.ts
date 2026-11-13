import type { Intersection, Object3D } from 'three'
import { catalogById } from '../data/catalog'
import { DEFAULT_FAVORITES, sanitizeFavorites } from '../persistence/favorites'
export function aimedPlant(hits:readonly Intersection[]):string|null {
  for(const hit of hits){
    let object:Object3D|null=hit.object
    while(object&&!object.userData.plantId)object=object.parent
    if(object)return object.userData.plantId as string
    if(hit.object.type==='Mesh')return null
  }
  return null
}
export function equipmentForFavorites(favorites: readonly string[]) {
  const ids=sanitizeFavorites([...favorites])
  const items:{label:string;speciesId:string|null;action:string}[]=Array.from({length:4},(_,i)=>({label:ids[i]?catalogById.get(ids[i])!.commonName:'Empty favorite',speciesId:ids[i]??null,action:ids[i]?'plant':'empty'}))
  return [...items,{label:'Move plants',speciesId:null,action:'move'},{label:'Cancel',speciesId:null,action:'cancel'}]
}
export const equipmentItems=equipmentForFavorites(DEFAULT_FAVORITES)
export function wheelSector(x:number,y:number):number|null {
  if(Math.hypot(x,y)<.45)return null
  const angle=(Math.atan2(x,-y)+Math.PI*2)%(Math.PI*2)
  return Math.round(angle/(Math.PI*2/equipmentItems.length))%equipmentItems.length
}
export function buttonEdges(current:readonly boolean[],previous:readonly boolean[]|null):boolean[]{
  return current.map((value,index)=>Boolean(previous&&value&&!previous[index]))
}
