import { create } from 'zustand'
import { catalogById } from '../data/catalog'
import { isInsidePickwickProperty } from '../data/pickwickProperty'
import { defaultDesign, loadDesign, parseDesign, saveDesign } from '../persistence/design'
import type { PlantInstance, PropertyDesign, Season } from '../types'

export type ViewMode = 'garden' | 'planner' | 'walk'

interface PlannerState {
  design: PropertyDesign; year: number; season: Season; viewMode: ViewMode; selectedPlantId: string | null; armedSpeciesId: string | null; cameraResetKey: number; notice: string | null
  setYear: (year:number)=>void; setSeason:(season:Season)=>void; setViewMode:(viewMode:ViewMode)=>void; armSpecies:(id:string|null)=>void; selectPlant:(id:string|null)=>void
  placePlant:(speciesId:string,xFt:number,zFt:number)=>void; movePlant:(id:string,xFt:number,zFt:number)=>void; deletePlant:(id:string)=>void; duplicatePlant:(id:string)=>void
  resetCamera:()=>void; resetDesign:()=>void; importDesign:(json:string)=>void; persist:()=>void; clearNotice:()=>void
}

const initialDesign = typeof localStorage === 'undefined' ? defaultDesign : loadDesign()

export const usePlannerStore = create<PlannerState>((set, get) => ({
  design: initialDesign, year: 10, season: 'summer', viewMode: 'garden', selectedPlantId: null, armedSpeciesId: null, cameraResetKey: 0, notice: null,
  setYear: (year) => set({year}), setSeason: (season) => set({season}), setViewMode:(viewMode)=>set({viewMode,cameraResetKey:get().cameraResetKey+1,armedSpeciesId:viewMode==='walk'?null:get().armedSpeciesId}), armSpecies: (armedSpeciesId) => set({armedSpeciesId, selectedPlantId:null}), selectPlant:(selectedPlantId)=>set({selectedPlantId,armedSpeciesId:null}),
  placePlant:(speciesId,xFt,zFt)=>set((state)=>{ if(!catalogById.has(speciesId)||!isInsidePickwickProperty({xFt,zFt})) return state; const plant:PlantInstance={id:crypto.randomUUID(),speciesId,xFt,zFt,plantedYear:0}; return {design:{...state.design,plants:[...state.design.plants,plant]},selectedPlantId:plant.id,armedSpeciesId:null} }),
  movePlant:(id,xFt,zFt)=>set((state)=>{if(!isInsidePickwickProperty({xFt,zFt}))return state;return {design:{...state.design,plants:state.design.plants.map((plant)=>plant.id===id?{...plant,xFt,zFt}:plant)}}}),
  deletePlant:(id)=>set((state)=>({design:{...state.design,plants:state.design.plants.filter((p)=>p.id!==id)},selectedPlantId:state.selectedPlantId===id?null:state.selectedPlantId})),
  duplicatePlant:(id)=>set((state)=>{const source=state.design.plants.find((p)=>p.id===id);if(!source)return state;const candidate={xFt:source.xFt+5,zFt:source.zFt+5};const p=isInsidePickwickProperty(candidate)?candidate:{xFt:source.xFt-5,zFt:source.zFt-5};const copy={...source,...p,id:crypto.randomUUID()};return {design:{...state.design,plants:[...state.design.plants,copy]},selectedPlantId:copy.id}}),
  resetCamera:()=>set((s)=>({cameraResetKey:s.cameraResetKey+1})), resetDesign:()=>set({design:{...defaultDesign,plants:defaultDesign.plants.map((plant)=>({...plant}))},selectedPlantId:null,armedSpeciesId:null,notice:'Design reset to mapped existing conditions.'}),
  importDesign:(json)=>{const design=parseDesign(json);set({design,selectedPlantId:null,armedSpeciesId:null,notice:'Design imported.'})},
  persist:()=>{saveDesign(get().design);set({notice:'Design saved locally.'})}, clearNotice:()=>set({notice:null}),
}))
