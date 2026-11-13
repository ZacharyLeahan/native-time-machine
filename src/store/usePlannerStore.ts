import { create } from 'zustand'
import { catalogById } from '../data/catalog'
import { placementError } from '../simulation/placement'
import { defaultDesign, loadDesign, parseDesign, saveDesign } from '../persistence/design'
import type { PlantInstance, PropertyDesign, Season } from '../types'
import { equipmentForFavorites } from '../simulation/controller'
import { FAVORITES_KEY, DEFAULT_FAVORITES, loadFavorites, MAX_FAVORITES } from '../persistence/favorites'
import { isPointInsidePolygon } from '../simulation/walkNavigation'
import { pickwickProperty } from '../data/pickwickProperty'

export type ViewMode = 'garden' | 'planner' | 'walk' | 'spectator'
interface PlannerState {
  recordedBoundary:boolean; toggleBoundary:()=>void; coordinateGrid:boolean; toggleCoordinateGrid:()=>void
  favorites:string[]; toggleFavorite:(id:string)=>void
  cameraShortcut:{preset:'front'|'back'|'left'|'right'|'selected';id:number}|null
  requestCamera:(preset:'front'|'back'|'left'|'right'|'selected')=>void
  walkCarry:{id:string;xFt:number;zFt:number;speciesId?:string}|null; walkPrompt:string; lookDeadzone:number; setLookDeadzone:(value:number)=>void
  wheelOpen:boolean;wheelIndex:number|null; chooseEquipment:(index:number|null,xFt:number,zFt:number)=>void; dropCarried:(xFt:number,zFt:number,playerX:number,playerZ:number)=>boolean
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
    if(get().viewMode==='spectator')return
    get().endMove()
    set(s=>({design,past:[...s.past,s.design].slice(-100),future:[],saveStatus:'Saving…'}))
  }
  const save=()=>{try{saveDesign(get().design);set({saveStatus:'Saved locally'})}catch{set({saveStatus:'Could not save — export a backup',notice:'Local saving failed. Export your design to keep a backup.'})}}
  return {
    recordedBoundary:true,toggleBoundary:()=>set(s=>({recordedBoundary:!s.recordedBoundary})),
    coordinateGrid:false,toggleCoordinateGrid:()=>set(s=>({coordinateGrid:!s.coordinateGrid})),
    favorites:typeof localStorage==='undefined'?[...DEFAULT_FAVORITES]:loadFavorites(localStorage),
    toggleFavorite:id=>{
      const s=get(),species=catalogById.get(id)
      if(!species||species.catalogVisible===false)return
      if(!s.favorites.includes(id)&&s.favorites.length>=MAX_FAVORITES){set({notice:'Your plant kit holds four favorites. Remove a star to make room.'});return}
      const favorites=s.favorites.includes(id)?s.favorites.filter(f=>f!==id):[...s.favorites,id]
      set({favorites,wheelOpen:false,wheelIndex:null})
      try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites))}catch{set({notice:'Favorites updated for this session; local saving is unavailable.'})}
    },
    cameraShortcut:null,
    requestCamera:preset=>{
      if(preset==='selected'&&!get().design.plants.some(p=>p.id===get().selectedPlantId))return
      get().endMove()
      set(s=>({viewMode:'garden',walkCarry:null,wheelOpen:false,wheelIndex:null,armedSpeciesId:null,cameraShortcut:{preset,id:(s.cameraShortcut?.id??0)+1}}))
    },
    wheelOpen:false,wheelIndex:null,
    chooseEquipment:(index,xFt,zFt)=>{
      if(get().viewMode==='spectator')return
      if(index===null){set({wheelOpen:false,wheelIndex:null});return}
      const item=equipmentForFavorites(get().favorites)[index];if(!item)return
      if(item.action==='empty'){set({wheelOpen:false,wheelIndex:null,walkPrompt:'Add a favorite from the plant library to fill this slot.'});return}
      set({wheelOpen:false,wheelIndex:null,walkCarry:item.speciesId?{id:'walk-preview',speciesId:item.speciesId,xFt,zFt}:null,walkPrompt:item.speciesId?`${item.label} ready · X / RT plant`:item.action==='move'?'Aim at a plant · X picks up':'Selection cancelled'})
    },
    dropCarried:(xFt,zFt,playerX,playerZ)=>{
      if(get().viewMode==='spectator')return false
      const carry=get().walkCarry;if(!carry)return false
      let error=placementError(xFt,zFt)
      const steps=Math.max(1,Math.ceil(Math.hypot(xFt-playerX,zFt-playerZ)))
      for(let i=0;i<=steps;i++)if(isPointInsidePolygon({xFt:playerX+(xFt-playerX)*i/steps,zFt:playerZ+(zFt-playerZ)*i/steps},pickwickProperty.buildingFootprint))error='Cannot place a plant through the house.'
      if(error){set({walkPrompt:error});return false}
      if(carry.speciesId)get().placePlant(carry.speciesId,xFt,zFt);else get().movePlant(carry.id,xFt,zFt)
      set({walkCarry:null,walkPrompt:'Plant placed · X picks up another'});return true
    },
    walkCarry:null,walkPrompt:'Aim at a plant · X picks up',lookDeadzone:.25,setLookDeadzone:value=>set({lookDeadzone:Math.max(.1,Math.min(.4,value))}),
    design:initialDesign,year:10,season:'summer',viewMode:'garden',selectedPlantId:null,armedSpeciesId:null,cameraResetKey:0,notice:null,
    past:[],future:[],moveBaseline:null,saveStatus:'Saved locally',
    setYear:year=>set({year}),setSeason:season=>set({season}),
    setViewMode:viewMode=>{get().endMove();set({viewMode,cameraShortcut:null,walkCarry:null,wheelOpen:false,wheelIndex:null,cameraResetKey:get().cameraResetKey+1,armedSpeciesId:viewMode==='walk'||viewMode==='spectator'?null:get().armedSpeciesId,selectedPlantId:viewMode==='spectator'?null:get().selectedPlantId})},
    armSpecies:armedSpeciesId=>set({armedSpeciesId,selectedPlantId:null}),selectPlant:selectedPlantId=>set({selectedPlantId,armedSpeciesId:null}),
    placePlant:(speciesId,xFt,zFt)=>{
      if(get().viewMode==='spectator')return
      const error=placementError(xFt,zFt)
      if(error||!catalogById.has(speciesId)){set({notice:error??'Choose a known species.'});return}
      const plant:PlantInstance={id:crypto.randomUUID(),speciesId,xFt,zFt,plantedYear:0}
      commit({...get().design,plants:[...get().design.plants,plant]});set({selectedPlantId:plant.id,armedSpeciesId:null})
    },
    beginMove:()=>{if(!get().moveBaseline)set({moveBaseline:get().design})},
    endMove:()=>{const s=get();if(!s.moveBaseline)return;set({past:s.moveBaseline===s.design?s.past:[...s.past,s.moveBaseline].slice(-100),future:s.moveBaseline===s.design?s.future:[],moveBaseline:null})},
    movePlant:(id,xFt,zFt)=>{
      if(get().viewMode==='spectator')return
      const error=placementError(xFt,zFt)
      if(error){set({notice:error});return}
      const s=get(),plant=s.design.plants.find(p=>p.id===id)
      if(!plant||(plant.xFt===xFt&&plant.zFt===zFt))return
      const design={...s.design,plants:s.design.plants.map(p=>p.id===id?{...p,xFt,zFt}:p)}
      if(s.moveBaseline)set({design,saveStatus:'Saving…'});else commit(design)
    },
    deletePlant:id=>{const s=get();if(s.viewMode==='spectator'||!s.design.plants.some(p=>p.id===id))return;commit({...s.design,plants:s.design.plants.filter(p=>p.id!==id)});set({selectedPlantId:null})},
    duplicatePlant:id=>{
      if(get().viewMode==='spectator')return
      const s=get(),source=s.design.plants.find(p=>p.id===id);if(!source)return
      for(const radius of [5,10,15,20])for(let i=0;i<8;i++){
        const xFt=source.xFt+Math.cos(i*Math.PI/4)*radius,zFt=source.zFt+Math.sin(i*Math.PI/4)*radius
        if(placementError(xFt,zFt)||s.design.plants.some(p=>Math.hypot(p.xFt-xFt,p.zFt-zFt)<1))continue
        const copy={...source,xFt,zFt,id:crypto.randomUUID()};commit({...s.design,plants:[...s.design.plants,copy]});set({selectedPlantId:copy.id});return
      }
      set({notice:'No valid nearby position found for a duplicate.'})
    },
    undo:()=>{if(get().viewMode==='spectator')return;get().endMove();const s=get(),design=s.past.at(-1);if(!design)return;set({design,past:s.past.slice(0,-1),future:[s.design,...s.future],selectedPlantId:null,armedSpeciesId:null,saveStatus:'Saving…'})},
    redo:()=>{if(get().viewMode==='spectator')return;get().endMove();const s=get(),design=s.future[0];if(!design)return;set({design,past:[...s.past,s.design],future:s.future.slice(1),selectedPlantId:null,armedSpeciesId:null,saveStatus:'Saving…'})},
    resetCamera:()=>set(s=>({cameraShortcut:null,cameraResetKey:s.cameraResetKey+1})),
    resetDesign:()=>{commit({...defaultDesign,plants:[]});set({selectedPlantId:null,armedSpeciesId:null,notice:'Design reset. Undo restores it.'})},
    importDesign:json=>{if(get().viewMode==='spectator')return;const design=parseDesign(json);commit(design);set({selectedPlantId:null,armedSpeciesId:null,notice:'Design imported. Undo restores the previous design.'})},
    persist:save,autosave:save,clearNotice:()=>set({notice:null}),
  }
})
