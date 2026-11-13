import { catalogById } from '../data/catalog'
import { dimensionsForPlantAtYear } from './growth'
import type { PropertyDesign } from '../types'

export function plantingSummary(design:PropertyDesign,year:number) {
  const rows=new Map<string,{speciesId:string;commonName:string;scientificName:string;plants:{id:string;xFt:number;zFt:number;heightFt:number;widthFt:number;existing:boolean}[]}>()
  for(const plant of design.plants){
    const species=catalogById.get(plant.speciesId)
    if(!species)continue
    const row=rows.get(species.id)??{speciesId:species.id,commonName:species.commonName,scientificName:species.scientificName,plants:[]}
    const dims=dimensionsForPlantAtYear(species,plant,year)
    row.plants.push({id:plant.id,xFt:plant.xFt,zFt:plant.zFt,heightFt:dims.heightFt,widthFt:dims.widthFt,existing:plant.origin==='existing-inferred'||plant.origin==='existing-lidar'})
    rows.set(species.id,row)
  }
  return [...rows.values()].sort((a,b)=>a.commonName.localeCompare(b.commonName))
}
