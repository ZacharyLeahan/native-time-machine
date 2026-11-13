/* eslint-disable react-hooks/immutability -- R3F camera controls intentionally mutate Three.js camera and controls. */
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { usePlannerStore } from '../store/usePlannerStore'
import { cameraShot, type CameraPreset } from '../simulation/cameraShots'
import { catalogById } from '../data/catalog'
import { dimensionsForPlantAtYear } from '../simulation/growth'
import { groundHeight } from '../simulation/surface'

export function CameraShortcuts() {
  const selected=usePlannerStore(s=>s.selectedPlantId),request=usePlannerStore(s=>s.requestCamera),shortcut=usePlannerStore(s=>s.cameraShortcut)
  const shots:{preset:CameraPreset;label:string}[]=[{preset:'front',label:'Front'},{preset:'back',label:'Back'},{preset:'left',label:'Left'},{preset:'right',label:'Right'},{preset:'selected',label:'Focus plant'}]
  return <div className="camera-shortcuts" role="group" aria-label="Camera shortcuts"><span>Views</span>{shots.map(shot=><button key={shot.preset} disabled={shot.preset==='selected'&&!selected} aria-pressed={shortcut?.preset===shot.preset} onClick={()=>request(shot.preset)}>{shot.label}</button>)}</div>
}

export function CameraShortcutsRig() {
  const command=usePlannerStore(s=>s.cameraShortcut),reset=usePlannerStore(s=>s.cameraResetKey)
  const {camera,controls,size}=useThree()
  const pending=useRef<ReturnType<typeof cameraShot>|null>(null)
  useEffect(()=>{
    const orbit=controls as OrbitControlsImpl|undefined
    if(!command||!orbit){pending.current=null;return}
    const state=usePlannerStore.getState(),plant=state.design.plants.find(p=>p.id===state.selectedPlantId),species=plant?catalogById.get(plant.speciesId):undefined
    const dims=plant&&species?dimensionsForPlantAtYear(species,plant,state.year):null
    pending.current=cameraShot(command.preset,plant&&dims?{x:plant.xFt,y:groundHeight(plant.xFt,plant.zFt),z:-plant.zFt,height:dims.heightFt,width:dims.widthFt}:undefined,size.width/size.height)
    const shot=pending.current,distance=Math.hypot(...shot.position.map((value,index)=>value-shot.target[index]))
    // Portrait framing can require more distance than the normal orbit limit.
    orbit.maxDistance=Math.max(orbit.maxDistance,distance+1)
    if(camera instanceof PerspectiveCamera){camera.far=Math.max(camera.far,distance+300);camera.updateProjectionMatrix()}
    const cancel=()=>{pending.current=null;usePlannerStore.setState({cameraShortcut:null})}
    orbit.addEventListener('start',cancel)
    return()=>{pending.current=null;orbit.removeEventListener('start',cancel)}
  },[command,reset,camera,controls,size.width,size.height])
  useFrame((_,delta)=>{
    const shot=pending.current,orbit=controls as OrbitControlsImpl|undefined
    if(!shot||!orbit)return
    const position=new Vector3(...shot.position),target=new Vector3(...shot.target),blend=1-Math.exp(-7*Math.min(delta,.05))
    camera.position.lerp(position,blend);orbit.target.lerp(target,blend)
    if(camera.position.distanceTo(position)<.05&&orbit.target.distanceTo(target)<.05){camera.position.copy(position);orbit.target.copy(target);pending.current=null}
    orbit.update()
  },-2)
  return null
}
