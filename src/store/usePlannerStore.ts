import { create } from 'zustand'
import { catalogById } from '../data/catalog'
import { placementError } from '../simulation/placement'
import { defaultDesign, loadDesign, parseDesign, saveDesign } from '../persistence/design'
import type { PlantInstance, PropertyDesign, Season } from '../types'
import { equipmentForFavorites } from '../simulation/controller'
import { FAVORITES_KEY, DEFAULT_FAVORITES, loadFavorites, MAX_FAVORITES } from '../persistence/favorites'
import { isPointInsidePolygon } from '../simulation/walkNavigation'
import { pickwickProperty } from '../data/pickwickProperty'
import { displayBoundary, type BoundaryView } from '../data/displayBoundary'
import { arrangePlantingGroup, movePlantingGroup, plantingFrame, type ArrangeAction, type PlantingFrame } from '../simulation/plantingGroup'
import { selectionWheelItems, type SelectionAction } from '../simulation/selectionActions'
import { captureGrab, grabbedPoint, type GrabOffset, type GrabPoint, type GrabPose } from '../simulation/grab'
import { groundHeight } from '../simulation/surface'

export interface WalkArrangement {baseline:PropertyDesign;original:PlantInstance[];preview:PlantInstance[];frame:PlantingFrame;source:string;error:string|null;grab?:{offset:GrabOffset;anchor:GrabPoint;plants:PlantInstance[];pose:GrabPose;liftFt:number}}

export type ViewMode = 'garden' | 'planner' | 'walk' | 'spectator'
interface PlannerState {
  grabPlants:(ids?:string[],pose?:GrabPose)=>void;updateGrab:(pose:GrabPose)=>void
  walkSelecting:boolean;walkDeleteId:string|null;walkInspectId:string|null
  selectWalkPlant:(id:string)=>void;selectionAction:(action:SelectionAction,yaw?:number)=>void;confirmWalkDelete:()=>void;cancelWalkDelete:()=>void
  walkMarked:string[];walkTargetId:string|null;walkArrangement:WalkArrangement|null
  toggleWalkMark:(id:string)=>void;startArrangement:(ids?:string[],yaw?:number)=>void;cancelArrangement:(clearSelection?:boolean)=>void
  moveArrangement:(along:number,away:number,snap?:boolean)=>void;arrangeGroup:(action:ArrangeAction)=>void;applyArrangement:()=>boolean
  aerialAligned:boolean; setBoundaryView:(view:BoundaryView)=>void
  recordedBoundary:boolean; toggleBoundary:()=>void; coordinateGrid:boolean; toggleCoordinateGrid:()=>void
  favorites:string[]; toggleFavorite:(id:string)=>void
  cameraShortcut:{preset:'front'|'back'|'left'|'right'|'selected';id:number}|null
  requestCamera:(preset:'front'|'back'|'left'|'right'|'selected')=>void
  walkCarry:{id:string;xFt:number;zFt:number;speciesId?:string}|null; walkPrompt:string; lookDeadzone:number; setLookDeadzone:(value:number)=>void
  wheelOpen:boolean;wheelIndex:number|null; chooseEquipment:(index:number|null,xFt:number,zFt:number,yaw?:number)=>void; dropCarried:(xFt:number,zFt:number,playerX:number,playerZ:number)=>boolean
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
    set(s=>({design,past:[...s.past,s.design].slice(-100),future:[],saveStatus:'Saving…',walkArrangement:null,walkMarked:[],walkDeleteId:null,walkInspectId:null}))
  }
  const groupError=(plants:PlantInstance[])=>{
    for(const plant of plants){const error=placementError(plant.xFt,plant.zFt);if(error)return `${catalogById.get(plant.speciesId)?.commonName??'Plant'}: ${error}`}
    return null
  }
  const previewGroup=(preview:PlantInstance[],releaseGrab=false)=>{const group=get().walkArrangement;if(group)set({walkArrangement:{...group,...(releaseGrab?{grab:undefined}:{}),preview,error:groupError(preview)}})}
  const save=()=>{try{saveDesign(get().design);set({saveStatus:'Saved locally'})}catch{set({saveStatus:'Could not save — export a backup',notice:'Local saving failed. Export your design to keep a backup.'})}}
  return {
    grabPlants:(ids,pose)=>{
      if(!pose||get().viewMode!=='walk'||get().walkDeleteId)return
      get().startArrangement(ids,pose.yaw)
      const group=get().walkArrangement;if(!group)return
      const first=group.preview[0],anchor={xFt:first.xFt,zFt:first.zFt,heightFt:groundHeight(first.xFt,first.zFt)+.8}
      set({walkArrangement:{...group,grab:{anchor,offset:captureGrab(anchor,pose),plants:group.preview,pose,liftFt:.8}},walkPrompt:`Grabbed ${group.preview.length} · walk / look to carry · X / RT drops · B cancels`})
    },
    updateGrab:pose=>{
      const group=get().walkArrangement,grab=group?.grab;if(get().viewMode!=='walk'||!group||!grab)return
      const target=grabbedPoint(grab.offset,pose),dx=target.xFt-grab.anchor.xFt,dz=target.zFt-grab.anchor.zFt
      const liftFt=Math.max(.8,target.heightFt-groundHeight(target.xFt,target.zFt))
      if(Math.abs(pose.xFt-grab.pose.xFt)+Math.abs(pose.zFt-grab.pose.zFt)+Math.abs(pose.heightFt-grab.pose.heightFt)+Math.abs(pose.yaw-grab.pose.yaw)+Math.abs(pose.pitch-grab.pose.pitch)<1e-8)return
      const preview=grab.plants.map(p=>({...p,xFt:p.xFt+dx,zFt:p.zFt+dz}))
      set({walkArrangement:{...group,preview,error:groupError(preview),grab:{...grab,pose,liftFt}}})
    },
    walkSelecting:false,walkDeleteId:null,walkInspectId:null,
    selectWalkPlant:id=>{const s=get();if(s.viewMode==='walk'&&!s.walkMarked.includes(id))s.toggleWalkMark(id)},
    selectionAction:(action,yaw=0)=>{
      const s=get();if(s.viewMode!=='walk'||s.walkDeleteId)return
      const id=s.walkMarked[0],single=s.walkMarked.length===1&&s.design.plants.some(p=>p.id===id)
      if(action==='clear'){s.cancelArrangement(true);set({walkInspectId:null});return}
      if(action==='cancel'){s.cancelArrangement();return}
      if(action==='move'){if(single&&!s.walkArrangement)s.startArrangement([id],yaw);else if(s.walkArrangement?.grab)set({walkArrangement:{...s.walkArrangement,grab:undefined},walkPrompt:'Precise move · RS slides · D-pad 1 ft'});return}
      if(action==='inspect'){if(single)set({walkInspectId:id});return}
      if(action==='delete'){
        if(single)set({walkDeleteId:id,walkArrangement:null,walkCarry:null,walkSelecting:false,wheelOpen:false,wheelIndex:null,walkPrompt:'Delete selected plant? A confirms · B cancels'})
        return
      }
      if(action==='duplicate'){
        if(!single)return
        s.duplicatePlant(id)
        const copy=get().selectedPlantId
        if(copy&&copy!==id&&!s.design.plants.some(p=>p.id===copy))set({walkMarked:[copy],walkInspectId:null,walkPrompt:'Copy selected · X moves it · LB opens plant actions',notice:'Plant duplicated · Undo removes the copy'})
        return
      }
      if(!s.walkArrangement)s.startArrangement(undefined,yaw)
      get().arrangeGroup(action)
    },
    confirmWalkDelete:()=>{
      const s=get(),id=s.walkDeleteId
      if(s.viewMode!=='walk'||!id)return
      const plant=s.design.plants.find(p=>p.id===id)
      if(!plant){set({walkDeleteId:null});return}
      const name=catalogById.get(plant.speciesId)?.commonName??'Plant'
      s.deletePlant(id)
      set({walkDeleteId:null,walkMarked:[],walkTargetId:null,walkPrompt:`${name} deleted · Undo restores it`,notice:`Deleted ${name} · Undo restores it`})
    },
    cancelWalkDelete:()=>set({walkDeleteId:null,walkPrompt:'Delete cancelled · selection kept'}),
    walkMarked:[],walkTargetId:null,walkArrangement:null,
    toggleWalkMark:id=>{
      const s=get();if(s.viewMode!=='walk'||s.walkArrangement||s.walkCarry||s.walkDeleteId||!s.design.plants.some(p=>p.id===id))return
      if(!s.walkMarked.includes(id)&&s.walkMarked.length>=12){set({notice:'A planting group holds up to 12 plants.'});return}
      const walkMarked=s.walkMarked.includes(id)?s.walkMarked.filter(p=>p!==id):[...s.walkMarked,id]
      set({walkMarked,walkInspectId:null,walkPrompt:walkMarked.length?`${walkMarked.length} selected · hold View to add · Menu toggles · LB opens actions`:'Selection cleared'})
    },
    startArrangement:(ids,yaw=0)=>{
      const s=get();if(s.viewMode!=='walk'||s.walkDeleteId)return
      const selected=[...new Set(ids??s.walkMarked)].slice(0,12),original=selected.flatMap(id=>s.design.plants.filter(p=>p.id===id))
      if(!original.length)return
      const preview=original.map(p=>s.walkCarry?.id===p.id?{...p,xFt:s.walkCarry.xFt,zFt:s.walkCarry.zFt}:{...p})
      const boundary=displayBoundary(s.recordedBoundary,s.aerialAligned),frame=plantingFrame(preview[0],boundary.points,yaw)
      set({walkArrangement:{baseline:s.design,original,preview,frame,source:boundary.label,error:groupError(preview)},walkMarked:original.map(p=>p.id),walkTargetId:null,walkCarry:null,wheelOpen:false,wheelIndex:null,selectedPlantId:original[0].id,walkPrompt:`Moving ${original.length} · RS moves · D-pad 1 ft · X / RT applies`})
    },
    cancelArrangement:(clearSelection=false)=>{if(get().viewMode!=='walk')return;set({walkArrangement:null,walkMarked:clearSelection?[]:get().walkMarked,wheelOpen:false,wheelIndex:null,walkPrompt:'Move cancelled · saved plants unchanged'})},
    moveArrangement:(along,away,snap=false)=>{const s=get();if(s.viewMode==='walk'&&s.walkArrangement&&Number.isFinite(along)&&Number.isFinite(away))previewGroup(movePlantingGroup(s.walkArrangement.preview,s.walkArrangement.frame,along,away,snap),true)},
    arrangeGroup:action=>{
      const s=get();if(s.viewMode!=='walk')return
      if(action==='cancel'){s.cancelArrangement();return}
      if(!s.walkArrangement)s.startArrangement()
      const group=get().walkArrangement;if(!group)return
      previewGroup(arrangePlantingGroup(group.preview,group.frame,action,p=>{const width=catalogById.get(p.speciesId)?.matureWidthFt;return width?(width[0]+width[1])/2:1}),true)
      set({walkPrompt:action==='canopy'?'Approximate mature canopy widths + 2 ft gap · preview only':'Layout preview · X / RT applies · B cancels'})
    },
    applyArrangement:()=>{
      const s=get(),group=s.walkArrangement;if(s.viewMode!=='walk'||!group)return false
      let error=s.design!==group.baseline?'Design changed. Cancel this preview and select again.':groupError(group.preview)
      if(group.grab&&!error)for(const plant of group.preview){const from=group.grab.pose,steps=Math.max(1,Math.ceil(Math.hypot(plant.xFt-from.xFt,plant.zFt-from.zFt)));for(let i=0;i<=steps;i++)if(isPointInsidePolygon({xFt:from.xFt+(plant.xFt-from.xFt)*i/steps,zFt:from.zFt+(plant.zFt-from.zFt)*i/steps},pickwickProperty.buildingFootprint))error='Cannot drop a grabbed plant through the house.'}
      if(error){set({walkArrangement:{...group,error},walkPrompt:error});return false}
      const changed=group.preview.some((p,i)=>Math.hypot(p.xFt-group.original[i].xFt,p.zFt-group.original[i].zFt)>1e-7)
      if(changed){const moved=new Map(group.preview.map(p=>[p.id,p]));commit({...s.design,plants:s.design.plants.map(p=>moved.get(p.id)??p)})}
      set({walkArrangement:null,walkMarked:[],walkPrompt:changed?`${group.preview.length} plants placed · Undo restores the group`:'Plants unchanged',notice:changed?`Placed ${group.preview.length} plants · one undo restores the group`:null})
      return true
    },
    aerialAligned:true,setBoundaryView:view=>set({recordedBoundary:view!=='gis',aerialAligned:view==='aerial'}),
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
      set(s=>({viewMode:'garden',walkCarry:null,walkArrangement:null,walkMarked:[],walkTargetId:null,walkSelecting:false,walkDeleteId:null,walkInspectId:null,wheelOpen:false,wheelIndex:null,armedSpeciesId:null,cameraShortcut:{preset,id:(s.cameraShortcut?.id??0)+1}}))
    },
    wheelOpen:false,wheelIndex:null,
    chooseEquipment:(index,xFt,zFt,yaw=0)=>{
      if(get().viewMode==='spectator')return
      if(index===null){set({wheelOpen:false,wheelIndex:null});return}
      if(get().walkArrangement||get().walkMarked.length){const item=selectionWheelItems(get().walkMarked.length,Boolean(get().walkArrangement))[index];if(item)get().selectionAction(item.action,yaw);set({wheelOpen:false,wheelIndex:null});return}
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
    setViewMode:viewMode=>{get().endMove();set({viewMode,cameraShortcut:null,walkCarry:null,walkArrangement:null,walkMarked:[],walkTargetId:null,walkSelecting:false,walkDeleteId:null,walkInspectId:null,wheelOpen:false,wheelIndex:null,cameraResetKey:get().cameraResetKey+1,armedSpeciesId:viewMode==='walk'||viewMode==='spectator'?null:get().armedSpeciesId,selectedPlantId:viewMode==='spectator'?null:get().selectedPlantId})},
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
    undo:()=>{if(get().viewMode==='spectator')return;if(get().walkArrangement){get().cancelArrangement();return}get().endMove();const s=get(),design=s.past.at(-1);if(!design)return;set({design,past:s.past.slice(0,-1),future:[s.design,...s.future],walkArrangement:null,walkMarked:[],walkSelecting:false,walkDeleteId:null,walkInspectId:null,walkTargetId:null,walkCarry:null,wheelOpen:false,wheelIndex:null,selectedPlantId:null,armedSpeciesId:null,saveStatus:'Saving…'})},
    redo:()=>{if(get().viewMode==='spectator')return;if(get().walkArrangement){get().cancelArrangement();return}get().endMove();const s=get(),design=s.future[0];if(!design)return;set({design,past:[...s.past,s.design],future:s.future.slice(1),walkArrangement:null,walkMarked:[],walkSelecting:false,walkDeleteId:null,walkInspectId:null,walkTargetId:null,walkCarry:null,wheelOpen:false,wheelIndex:null,selectedPlantId:null,armedSpeciesId:null,saveStatus:'Saving…'})},
    resetCamera:()=>set(s=>({cameraShortcut:null,walkArrangement:null,walkMarked:[],walkSelecting:false,walkDeleteId:null,walkInspectId:null,cameraResetKey:s.cameraResetKey+1})),
    resetDesign:()=>{commit({...defaultDesign,plants:[]});set({selectedPlantId:null,armedSpeciesId:null,notice:'Design reset. Undo restores it.'})},
    importDesign:json=>{if(get().viewMode==='spectator')return;const design=parseDesign(json);commit(design);set({selectedPlantId:null,armedSpeciesId:null,notice:'Design imported. Undo restores the previous design.'})},
    persist:save,autosave:save,clearNotice:()=>set({notice:null}),
  }
})
