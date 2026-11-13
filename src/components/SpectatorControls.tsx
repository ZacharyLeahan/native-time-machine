/* eslint-disable react-hooks/immutability -- Three.js camera is intentionally updated per frame. */
import { useEffect,useRef } from 'react'
import { useFrame,useThree } from '@react-three/fiber'
import { MathUtils,PerspectiveCamera } from 'three'
import { usePlannerStore } from '../store/usePlannerStore'
import { applyStickDeadzone,lookStick } from '../simulation/walkNavigation'
import { flightDelta } from '../simulation/spectator'
import { buttonEdges } from '../simulation/controller'
import './SpectatorControls.css'

export function SpectatorControls(){
  const {camera,gl}=useThree(),reset=usePlannerStore(s=>s.cameraResetKey)
  const keys=useRef(new Set<string>()),yaw=useRef(0),pitch=useRef(0),dragging=useRef(false),focused=useRef(true)
  const previous=useRef<boolean[]|null>(null),padId=useRef<string|null>(null)
  useEffect(()=>{
    camera.rotation.order='YXZ';camera.position.set(170,125,190);camera.lookAt(0,10,0)
    yaw.current=camera.rotation.y;pitch.current=camera.rotation.x;keys.current.clear()
  },[camera,reset])
  useEffect(()=>{
    const canvas=gl.domElement,doc=canvas.ownerDocument
    const down=(e:KeyboardEvent)=>{
      if(e.target instanceof HTMLElement&&(e.target.matches('input,select,textarea,button')||e.target.isContentEditable))return
      if(['w','a','s','d','q','e','c',' ','shift','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())){e.preventDefault();keys.current.add(e.key.toLowerCase())}
      if(e.key.toLowerCase()==='f')usePlannerStore.getState().setViewMode('garden')
    }
    const up=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase())
    const start=()=>{dragging.current=true}
    const end=()=>{dragging.current=false}
    const lock=()=>{if(doc.pointerLockElement!==canvas)canvas.requestPointerLock?.()?.catch(()=>{})}
    const move=(e:MouseEvent)=>{if(doc.pointerLockElement!==canvas&&!dragging.current)return;yaw.current-=e.movementX*.0021;pitch.current=MathUtils.clamp(pitch.current-e.movementY*.0021,-Math.PI*.49,Math.PI*.49)}
    const blur=()=>{keys.current.clear();dragging.current=false;focused.current=false;previous.current=null}
    const focus=()=>{focused.current=true;previous.current=null}
    canvas.addEventListener('pointerdown',start);canvas.addEventListener('click',lock)
    doc.addEventListener('pointerup',end);doc.addEventListener('mousemove',move)
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);window.addEventListener('focus',focus)
    return()=>{
      canvas.removeEventListener('pointerdown',start);canvas.removeEventListener('click',lock)
      doc.removeEventListener('pointerup',end);doc.removeEventListener('mousemove',move)
      window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus)
      if(doc.pointerLockElement===canvas)doc.exitPointerLock?.()
    }
  },[camera,gl])
  useFrame((_,dt)=>{
    if(!focused.current)return
    const delta=Math.min(dt,.05),k=keys.current
    let forward=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown'))
    let right=Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft'))
    let up=Number(k.has('e')||k.has(' '))-Number(k.has('q')||k.has('c')),fast=k.has('shift'),zoom=0
    const pad=navigator.getGamepads?.().find(p=>p?.connected&&p.mapping==='standard')
    if(pad){
      const id=`${pad.index}:${pad.id}`;if(id!==padId.current){previous.current=null;padId.current=id}
      const buttons=pad.buttons.map(b=>b.pressed||b.value>.55),edges=buttonEdges(buttons,previous.current)
      previous.current=buttons
      if(edges[1]){usePlannerStore.getState().setViewMode('garden');return}
      forward-=applyStickDeadzone(pad.axes[1]??0);right+=applyStickDeadzone(pad.axes[0]??0)
      up+=Number(Boolean(buttons[5]))-Number(Boolean(buttons[4]));fast=fast||Boolean(buttons[10]);zoom=pad.buttons[6]?.value??0
      const deadzone=usePlannerStore.getState().lookDeadzone
      yaw.current-=lookStick(pad.axes[2]??0,deadzone)*2.1*delta*(zoom>.15?.65:1)
      pitch.current=MathUtils.clamp(pitch.current-lookStick(pad.axes[3]??0,deadzone)*1.7*delta*(zoom>.15?.65:1),-Math.PI*.49,Math.PI*.49)
    }else{padId.current=null;previous.current=null}
    camera.rotation.set(pitch.current,yaw.current,0,'YXZ')
    const movement=flightDelta(forward,right,up,yaw.current,pitch.current,(fast?90:30)*delta)
    camera.position.x+=movement.x;camera.position.y+=movement.y;camera.position.z+=movement.z
    if(camera instanceof PerspectiveCamera){const target=zoom>.15?54:72;camera.fov=MathUtils.damp(camera.fov,target,18,delta);camera.updateProjectionMatrix()}
  })
  return null
}
