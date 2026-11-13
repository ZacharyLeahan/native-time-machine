import { Html, Line } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { catalogById } from '../data/catalog'
import { usePlannerStore } from '../store/usePlannerStore'
import { plantingCoordinates } from '../simulation/plantingGroup'
import { selectionWheelItems } from '../simulation/selectionActions'
import { dimensionsForPlantAtYear } from '../simulation/growth'
import { ControllerGlyph } from './ControllerGlyph'
import { PlacementMeasurementReadout } from './PlacementMeasurements'
import type { WalkAimRef } from './WalkControls'
import { groundHeight } from '../simulation/surface'
import type { YardPoint } from '../simulation/coordinates'
import './WalkPlantingTools.css'

export function WalkPlantingTools({aimRef}:{aimRef?:WalkAimRef}){
  const [expandedOverride,setExpandedOverride]=useState<boolean|null>(null)
  const deleteId=usePlannerStore(s=>s.walkDeleteId),inspectId=usePlannerStore(s=>s.walkInspectId),selecting=usePlannerStore(s=>s.walkSelecting),year=usePlannerStore(s=>s.year)
  const cancelDelete=useRef<HTMLButtonElement>(null)
  useEffect(()=>{if(deleteId)cancelDelete.current?.focus()},[deleteId])
  const marked=usePlannerStore(s=>s.walkMarked),group=usePlannerStore(s=>s.walkArrangement),target=usePlannerStore(s=>s.walkTargetId),plants=usePlannerStore(s=>s.design.plants),carry=usePlannerStore(s=>s.walkCarry)
  const state=usePlannerStore.getState(),selected=plants.filter(p=>marked.includes(p.id))
  const expanded=Boolean(inspectId)||(expandedOverride??Boolean(group||marked.length||carry||selecting))
  const setback=group?Math.min(...group.preview.map(p=>plantingCoordinates(p,group.frame).away)):null
  const gaps=group?group.preview.flatMap((p,i)=>group.preview.slice(i+1).map(q=>Math.hypot(p.xFt-q.xFt,p.zFt-q.zFt))):[]
  const names=selected.map(p=>catalogById.get(p.speciesId)?.commonName??'Plant')
  const inspected=plants.find(p=>p.id===inspectId),species=inspected?catalogById.get(inspected.speciesId):null,dims=inspected&&species?dimensionsForPlantAtYear(species,inspected,year):null
  if(deleteId)return <section className="walk-planting-tools delete-confirmation" role="alertdialog" aria-label="Delete selected plant" aria-describedby="walk-delete-description"><h3>Delete {catalogById.get(plants.find(p=>p.id===deleteId)?.speciesId??'')?.commonName??'plant'}?</h3><p id="walk-delete-description">A confirms · B cancels. Undo restores the plant.</p><div className="group-commit"><button className="confirm-delete" onClick={state.confirmWalkDelete}>A · Delete plant</button><button ref={cancelDelete} onClick={state.cancelWalkDelete}>B · Keep plant</button></div></section>
  return <section className={`walk-planting-tools ${group?'editing':''}`} aria-label="Planting group">
    <header><button className="group-tool-toggle" aria-label="Toggle planting group tools" aria-expanded={expanded} onClick={()=>setExpandedOverride(!expanded)}><strong>{group?.grab?`Grabbed · ${marked.length}`:group?'Precise move':carry?'Carrying 1 plant':selecting?`Selecting · ${marked.length}`:`Selection · ${marked.length}`}</strong><span className="controller-key">{carry||group?.grab?'X':<ControllerGlyph button="view"/>}</span></button></header>
    {expanded&&<>
    <p className="group-instruction">{group?.grab?'Walk and look to carry · X / RT drops · D-pad enters precise move':group?'RS slides plants · hold RB to look around':carry?carry.speciesId?'X / RT plants here · B cancels':'X / RT drops · D-pad enters precise move':<><ControllerGlyph button="view"/> Hold View + aim to add plants. <ControllerGlyph button="menu"/> Menu toggles one.</>}</p>
    {marked.length>0&&<p className="group-names" role="status">{names.slice(0,3).join(' / ')}{names.length>3?` + ${names.length-3} more`:''}</p>}
    {marked.length>0&&<PlacementMeasurementReadout/>}
    {!group&&<div className="group-actions">{marked.length===0&&<button disabled={!target||Boolean(carry)} onClick={()=>target&&state.toggleWalkMark(target)}>Menu · Select aimed plant</button>}{marked.length>0&&<><button onClick={()=>state.grabPlants(undefined,aimRef?.player)}>X · Grab {marked.length} selected</button><button onClick={()=>usePlannerStore.setState({wheelOpen:true,wheelIndex:null})}>LB · {marked.length===1?'Plant actions':'Align selection'}</button></>}{carry&&!carry.speciesId&&<button onClick={()=>state.startArrangement([carry.id])}>Precise move · D-pad</button>}</div>}
    <details className="group-plant-picker"><summary>Choose plants{marked.length?` · ${marked.length}/12`:''}</summary><div role="group" aria-label="Plants to arrange">{plants.length?plants.map((plant,index)=><label key={plant.id}><input type="checkbox" checked={marked.includes(plant.id)} disabled={Boolean(group||carry)} onChange={()=>state.toggleWalkMark(plant.id)}/><span>{index+1}. {catalogById.get(plant.speciesId)?.commonName??'Plant'}</span></label>):<p>Plant something from the LB kit first.</p>}</div></details>
    {group&&<>
      <div className="group-setback"><span>Setback from guide edge</span><strong>≈ {setback!.toFixed(1)} <small>ft</small></strong></div>
      {gaps.length>0&&<p className="group-spacing">Closest selected centers · ≈ {Math.min(...gaps).toFixed(1)} ft</p>}
      <div className="group-nudges" role="group" aria-label="One-foot boundary nudges"><button aria-label="Move group 1 foot away from boundary" onClick={()=>state.moveArrangement(0,1,true)}>↑ Away · 1 ft</button><button aria-label="Move group 1 foot left along boundary" onClick={()=>state.moveArrangement(-1,0,true)}>← 1 ft</button><span>D-pad</span><button aria-label="Move group 1 foot right along boundary" onClick={()=>state.moveArrangement(1,0,true)}>1 ft →</button><button aria-label="Move group 1 foot toward boundary" onClick={()=>state.moveArrangement(0,-1,true)}>↓ Toward · 1 ft</button></div>
      <details className="group-layout-picker"><summary>{marked.length===1?'Plant actions':'Alignment'} · hold LB</summary><div>{selectionWheelItems(marked.length,true).filter(item=>item.action!=='cancel').map(item=><button key={item.action} className={item.action==='delete'?'danger':''} onClick={event=>{const details=event.currentTarget.closest('details');if(details){details.open=false;details.querySelector('summary')?.focus()}state.selectionAction(item.action)}}>{item.label}</button>)}</div><p>Spacing follows the guide edge. Mature room uses average catalog crown widths + a 2 ft gap; estimates, not growth guarantees.</p></details>
      <p className="group-source">{group.source} · approximate. D-pad rounds the group's setback and anchor to whole feet. Planting limits use County GIS.</p>
      {group.error&&<p className="group-error" role="alert">{group.error}</p>}
      <div className="group-commit"><button disabled={Boolean(group.error)} onClick={state.applyArrangement}>X / RT · {group.grab?'Drop':'Apply'} {group.preview.length}</button><button onClick={()=>state.cancelArrangement()}>B · Cancel {group.grab?'grab':'move'}</button></div>
      <small className="group-preview-note">Preview only · apply creates one undo step.</small>
    </>}
    {inspected&&species&&dims&&<section className="selected-plant-details" aria-label="Selected plant details"><h3>{species.commonName}</h3><em>{species.scientificName}</em><p>Year {year} · {dims.heightFt.toFixed(1)} ft tall · {dims.widthFt.toFixed(1)} ft canopy · approximate</p><p>{species.sun} · {species.soil}</p><button onClick={()=>usePlannerStore.setState({walkInspectId:null})}>Close plant details</button></section>}
    {!group&&marked.length>0&&<button className="clear-group" onClick={()=>state.cancelArrangement(true)}>B · Clear selection</button>}
    </>}
  </section>
}
const world=(p:YardPoint,lift=.5):[number,number,number]=>[p.xFt,groundHeight(p.xFt,p.zFt)+lift,-p.zFt]
const noRaycast=()=>{}
export function WalkGroupOverlay(){
  const mode=usePlannerStore(s=>s.viewMode),marked=usePlannerStore(s=>s.walkMarked),group=usePlannerStore(s=>s.walkArrangement),design=usePlannerStore(s=>s.design)
  if(mode!=='walk')return null
  const plants=group?.preview??marked.flatMap(id=>design.plants.filter(p=>p.id===id))
  const anchor=group?.preview.reduce((best,p)=>plantingCoordinates(p,group.frame).away<plantingCoordinates(best,group.frame).away?p:best)
  const setback=group&&anchor?plantingCoordinates(anchor,group.frame).away:0
  const foot=group&&anchor?{xFt:anchor.xFt-group.frame.away.xFt*setback,zFt:anchor.zFt-group.frame.away.zFt*setback}:null
  return <group name="walk-planting-group">
    {anchor&&foot&&<><Line points={[world(anchor),world(foot)]} color="#f0d27a" lineWidth={2} transparent depthTest={false} depthWrite={false} raycast={noRaycast} renderOrder={33}/><Html center position={world({xFt:(anchor.xFt+foot.xFt)/2,zFt:(anchor.zFt+foot.zFt)/2},1)} zIndexRange={[6,0]} style={{pointerEvents:'none'}}><span className="group-axis-label">Guide ≈ {setback.toFixed(1)} ft</span></Html></>}
    {plants.map((plant,index)=><group key={plant.id}><mesh position={world(plant)} rotation={[-Math.PI/2,0,0]} raycast={noRaycast} renderOrder={32}><ringGeometry args={[1.7,2.1,40]}/><meshBasicMaterial color={group?.error?'#f19277':group?'#8ee8ef':'#f0d27a'} transparent depthTest={false} depthWrite={false}/></mesh><Html center position={world(plant,2)} zIndexRange={[6,0]} style={{pointerEvents:'none'}}><span className="group-plant-number">{index+1}{group?.grab?' · grabbed':group?' · moving':' · selected'}</span></Html></group>)}
    {group&&<>{group.original.map((plant,index)=><group key={`original-${plant.id}`}><mesh position={world(plant,.3)} rotation={[-Math.PI/2,0,0]} raycast={noRaycast}><ringGeometry args={[.8,1,24]}/><meshBasicMaterial color="#f5f2ea" transparent opacity={.5} depthTest={false} depthWrite={false}/></mesh><Line points={[world(plant),world(group.preview[index])]} color="#f5f2ea" transparent opacity={.45} dashed dashSize={1} gapSize={1} depthTest={false} raycast={noRaycast}/></group>)}{(['along','away'] as const).map(axis=>{const p=group.preview[0],end={xFt:p.xFt+group.frame[axis].xFt*8,zFt:p.zFt+group.frame[axis].zFt*8};return <group key={axis}><Line points={[world(p),world(end)]} color={axis==='along'?'#8ee8ef':'#f0d27a'} lineWidth={2} transparent depthTest={false} depthWrite={false} raycast={noRaycast} renderOrder={33}/><Html center position={world(end,1)} zIndexRange={[6,0]} style={{pointerEvents:'none'}}><span className="group-axis-label">{axis==='along'?'→ Along edge':'↑ Away from edge'}</span></Html></group>})}</>}
  </group>
}
