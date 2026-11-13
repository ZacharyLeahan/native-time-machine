import { create } from 'zustand'
import { catalogById } from '../data/catalog'
import { placementError } from '../simulation/placement'
import { defaultDesign, loadDesign, parseDesign, saveDesign } from '../persistence/design'
import type { PlantInstance, PropertyDesign, Season } from '../types'

export type ViewMode = 'garden' | 'planner' | 'walk'
interface PlannerState {
  walkCarry:{id:string;xFt:number;zFt:number}|null; walkPrompt:string; lookDeadzone:number; setLookDeadzone:(value:number)=>void
  design: PropertyDesign; year: number; season: Season; viewMode: ViewMode; selectedPlantId: string | null; armedSpeciesId: string | null; cameraResetKey: number; notice: string | null
  past: PropertyDesign[]; future: PropertyDesign[]; moveBaseline: PropertyDesign | null; saveStatus: string
  setYear:(year:number)=>void; setSeason:(season:Season)=>void; setViewMode:(mode:ViewMode)=>void; armSpecies:(id:string|null)=>void; selectPlant:(id:string|null)=>void
  placePlant:(speciesId:string,xFt:number,zFt:number)=>void; movePlant:(id:string,xFt:number,zFt:number)=>void; deletePlant:(id:string)=>void; duplicatePlant:(id:string)=>void
  beginMove:()=>void; endMove:()=>void; undo:()=>void; redo:()=>void
  resetCamera:()=>void; resetDesign:()=>void; importDesign:(json:string)=>void; persist:()=>void; autosave:()=>void; clearNotice:()=>void
}
const initialDesign = typeof localStorage === 'undefined' ? defaultDesign : loadDesign()
export const usePlannerStore = create<PlannerState>((set,get)=>{
  const commit=(design:PropertyDesign)=>{
    get().endMove()
    set(s=>({design,past:[...s.past,s.design].slice(-100),future:[],saveStatus:'Saving…'}))
  }
  const save=()=>{try{saveDesign(get().design);set({saveStatus:'Saved locally'})}catch{set({saveStatus:'Could not save — export a backup',notice:'Local saving failed. Export your design to keep a backup.'})}}
  return {
    walkCarry:null,walkPrompt:'Aim at a plant · X picks up',lookDeadzone:.25,setLookDeadzone:value=>set({lookDeadzone:Math.max(.1,Math.min(.4,value))}),
    design:initialDesign,year:10,season:'summer',viewMode:'garden',selectedPlantId:null,armedSpeciesId:null,cameraResetKey:0,notice:null,
    past:[],future:[],moveBaseline:null,saveStatus:'Saved locally',
    setYear:year=>set({year}),setSeason:season=>set({season}),
    setViewMode:viewMode=>{get().endMove();set({viewMode,walkCarry:null,cameraResetKey:get().cameraResetKey+1,armedSpeciesId:viewMode==='walk'?null:get().armedSpeciesId})},
    armSpecies:armedSpeciesId=>set({armedSpeciesId,selectedPlantId:null}),selectPlant:selectedPlantId=>set({selectedPlantId,armedSpeciesId:null}),
    placePlant:(speciesId,xFt,zFt)=>{
      const error=placementError(xFt,zFt)
      if(error||!catalogById.has(speciesId)){set({notice:error??'Choose a known species.'});return}
      const plant:PlantInstance={id:crypto.randomUUID(),speciesId,xFt,zFt,plantedYear:0}
      commit({...get().design,plants:[...get().design.plants,plant]});set({selectedPlantId:plant.id,armedSpeciesId:null})
    },
    beginMove:()=>{if(!get().moveBaseline)set({moveBaseline:get().design})},
    endMove:()=>{const s=get();if(!s.moveBaseline)return;set({past:s.moveBaseline===s.design?s.past:[...s.past,s.moveBaseline].slice(-100),future:s.moveBaseline===s.design?s.future:[],moveBaseline:null})},
    movePlant:(id,xFt,zFt)=>{
      const error=placementError(xFt,zFt)
      if(error){set({notice:error});return}
      const s=get(),plant=s.design.plants.find(p=>p.id===id)
      if(!plant||(plant.xFt===xFt&&plant.zFt===zFt))return
      const design={...s.design,plants:s.design.plants.map(p=>p.id===id?{...p,xFt,zFt}:p)}
      if(s.moveBaseline)set({design,saveStatus:'Saving…'});else commit(design)
    },
    deletePlant:id=>{const s=get();if(!s.design.plants.some(p=>p.id===id))return;commit({...s.design,plants:s.design.plants.filter(p=>p.id!==id)});set({selectedPlantId:null})},
    duplicatePlant:id=>{
      const s=get(),source=s.design.plants.find(p=>p.id===id);if(!source)return
      for(const radius of [5,10,15,20])for(let i=0;i<8;i++){
        const xFt=source.xFt+Math.cos(i*Math.PI/4)*radius,zFt=source.zFt+Math.sin(i*Math.PI/4)*radius
        if(placementError(xFt,zFt)||s.design.plants.some(p=>Math.hypot(p.xFt-xFt,p.zFt-zFt)<1))continue
        const copy={...source,xFt,zFt,id:crypto.randomUUID()};commit({...s.design,plants:[...s.design.plants,copy]});set({selectedPlantId:copy.id});return
      }
      set({notice:'No valid nearby position found for a duplicate.'})
    },
    undo:()=>{get().endMove();const s=get(),design=s.past.at(-1);if(!design)return;set({design,past:s.past.slice(0,-1),future:[s.design,...s.future],selectedPlantId:null,armedSpeciesId:null,saveStatus:'Saving…'})},
    redo:()=>{get().endMove();const s=get(),design=s.future[0];if(!design)return;set({design,past:[...s.past,s.design],future:s.future.slice(1),selectedPlantId:null,armedSpeciesId:null,saveStatus:'Saving…'})},
    resetCamera:()=>set(s=>({cameraResetKey:s.cameraResetKey+1})),
    resetDesign:()=>{commit({...defaultDesign,plants:[]});set({selectedPlantId:null,armedSpeciesId:null,notice:'Design reset. Undo restores it.'})},
    importDesign:json=>{const design=parseDesign(json);commit(design);set({selectedPlantId:null,armedSpeciesId:null,notice:'Design imported. Undo restores the previous design.'})},
    persist:save,autosave:save,clearNotice:()=>set({notice:null}),
  }
})
