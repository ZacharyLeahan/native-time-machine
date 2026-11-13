/* eslint-disable react-hooks/immutability -- R3F camera controls intentionally mutate Three.js objects each frame. */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { MathUtils, PerspectiveCamera, Raycaster, Vector2 } from 'three'
import { applyStickDeadzone, lookStick, jumpStep, isWalkPositionAllowed, walkDelta, type WalkObstacle } from '../simulation/walkNavigation'
import { placementError } from '../simulation/placement'
import { catalogById } from '../data/catalog'
import { usePlannerStore } from '../store/usePlannerStore'
import { groundHeight } from '../simulation/surface'
import { aimedPlant, buttonEdges, wheelSector } from '../simulation/controller'
import type { GrabPose } from '../simulation/grab'

const EYE_HEIGHT_FT=5.6
const START_POSITION={x:0,z:95}
export interface WalkAimRef {current:{xFt:number;zFt:number};player?:GrabPose}

export function WalkControls({obstacles,aimRef}:{obstacles:readonly WalkObstacle[];aimRef?:WalkAimRef}) {
  const {camera,gl,scene}=useThree()
  const resetKey=usePlannerStore((state)=>state.cameraResetKey)
  const setViewMode=usePlannerStore((state)=>state.setViewMode)
  const keys=useRef(new Set<string>())
  const yaw=useRef(0)
  const pitch=useRef(0)
  const stride=useRef(0)
  const controllerExitPressed=useRef(false)
  const draggingLook=useRef(false)
  const previousButtons=useRef<boolean[]|null>(null)
  const padId=useRef<string|null>(null)
  const wheelBlocked=useRef(false)
  const jump=useRef({height:0,velocity:0})
  const ray=useRef(new Raycaster())
  const hudClock=useRef(0)
  const focused=useRef(true)
  const dpadRepeat=useRef({mask:0,elapsed:0,next:.36})
  const sweepReady=useRef(false),sweepActive=useRef(false),sweepVisited=useRef(new Set<string>())
  const editSession=useRef<unknown>(null),editStickReady=useRef(false)
  const wasGrabbing=useRef(false)

  useEffect(()=>{
    camera.rotation.order='YXZ'
    camera.position.set(START_POSITION.x,EYE_HEIGHT_FT,START_POSITION.z)
    yaw.current=0
    pitch.current=0
    camera.rotation.set(0,0,0,'YXZ')
    if(aimRef)aimRef.current={xFt:START_POSITION.x,zFt:-START_POSITION.z+12}

    const canvas=gl.domElement
    const ownerDocument=canvas.ownerDocument
    const lockMouse=()=>{
      if(ownerDocument.pointerLockElement===canvas)return
      const request=canvas.requestPointerLock?.()
      request?.catch(()=>{/* Embedded and automation browsers may deny Pointer Lock; drag-look remains available. */})
    }
    const startDrag=()=>{draggingLook.current=true}
    const endDrag=()=>{draggingLook.current=false}
    const mouseMove=(event:MouseEvent)=>{
      const state=usePlannerStore.getState()
      if(!focused.current||state.walkDeleteId||state.wheelOpen||(state.walkArrangement&&!state.walkArrangement.grab&&!keys.current.has('r')))return
      if(ownerDocument.pointerLockElement!==canvas&&!draggingLook.current)return
      yaw.current-=event.movementX*.0021
      pitch.current=MathUtils.clamp(pitch.current-event.movementY*.0021,-Math.PI*.47,Math.PI*.47)
    }
    const keyDown=(event:KeyboardEvent)=>{
      if(typeof HTMLElement!=='undefined'&&event.target instanceof HTMLElement&&(event.target.closest('input,select,textarea,dialog[open],.disclosure-menu[open]')||event.target.isContentEditable))return
      if((event.key==='Enter'||event.key===' ')&&typeof HTMLElement!=='undefined'&&event.target instanceof HTMLElement&&event.target.closest('button,summary'))return
      const key=event.key.toLowerCase()
      const state=usePlannerStore.getState()
      if(state.walkDeleteId){if(key==='escape')state.cancelWalkDelete();else if(key==='enter')state.confirmWalkDelete();return}
      if(key==='m'&&!event.repeat&&state.walkTargetId){state.toggleWalkMark(state.walkTargetId);return}
      if((key==='g'||key==='enter')&&!event.repeat){if(state.walkArrangement)state.applyArrangement();else state.grabPlants(undefined,{xFt:camera.position.x,zFt:-camera.position.z,heightFt:camera.position.y,yaw:yaw.current,pitch:pitch.current});return}
      if(key==='escape'&&!state.wheelOpen&&(state.walkArrangement||state.walkMarked.length)){state.cancelArrangement(!state.walkArrangement);return}
      if(state.walkArrangement&&['arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();state.moveArrangement(Number(key==='arrowright')-Number(key==='arrowleft'),Number(key==='arrowup')-Number(key==='arrowdown'),true);return}
      if(key==='r')keys.current.add('r')
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)){event.preventDefault();keys.current.add(key)}
      if(key==='q'){
        if(ownerDocument.pointerLockElement===canvas)ownerDocument.exitPointerLock?.()
        setViewMode('garden')
      }
    }
    const keyUp=(event:KeyboardEvent)=>keys.current.delete(event.key.toLowerCase())
    const clearKeys=()=>{keys.current.clear();draggingLook.current=false;focused.current=false;previousButtons.current=null;sweepReady.current=false;sweepActive.current=false;sweepVisited.current.clear();dpadRepeat.current={mask:0,elapsed:0,next:.36};usePlannerStore.setState({walkCarry:null,walkArrangement:null,walkMarked:[],walkTargetId:null,walkSelecting:false,walkDeleteId:null,walkInspectId:null,wheelOpen:false,wheelIndex:null})}
    const focus=()=>{focused.current=true;previousButtons.current=null}
    canvas.addEventListener('click',lockMouse)
    canvas.addEventListener('pointerdown',startDrag)
    ownerDocument.addEventListener('pointerup',endDrag)
    ownerDocument.addEventListener('mousemove',mouseMove)
    window.addEventListener('keydown',keyDown)
    window.addEventListener('keyup',keyUp)
    window.addEventListener('blur',clearKeys)
    window.addEventListener('focus',focus)
    return()=>{
      canvas.removeEventListener('click',lockMouse)
      canvas.removeEventListener('pointerdown',startDrag)
      ownerDocument.removeEventListener('pointerup',endDrag)
      ownerDocument.removeEventListener('mousemove',mouseMove)
      window.removeEventListener('keydown',keyDown)
      window.removeEventListener('keyup',keyUp)
      window.removeEventListener('blur',clearKeys)
      window.removeEventListener('focus',focus)
      usePlannerStore.setState({walkCarry:null,walkArrangement:null,walkMarked:[],walkTargetId:null,walkSelecting:false,walkDeleteId:null,walkInspectId:null,wheelOpen:false,wheelIndex:null})
      if(ownerDocument.pointerLockElement===canvas)ownerDocument.exitPointerLock?.()
    }
  },[camera,gl,setViewMode,aimRef])

  useEffect(()=>{
    camera.position.set(START_POSITION.x,EYE_HEIGHT_FT,START_POSITION.z)
    yaw.current=0
    pitch.current=0
    jump.current={height:0,velocity:0}
    if(aimRef)aimRef.current={xFt:START_POSITION.x,zFt:-START_POSITION.z+12}
    usePlannerStore.setState({walkCarry:null,walkArrangement:null,walkMarked:[],walkTargetId:null,walkSelecting:false,walkDeleteId:null,walkInspectId:null,wheelOpen:false,wheelIndex:null})
  },[camera,resetKey,aimRef])

  useFrame((_,rawDelta)=>{
    const delta=Math.min(rawDelta,.05)
    const state=usePlannerStore.getState()
    const carry=state.walkCarry
    const editing=Boolean(state.walkArrangement)
    const grabbing=Boolean(state.walkArrangement?.grab)
    if(editSession.current!==(state.walkArrangement?.original??null)||wasGrabbing.current!==grabbing){editSession.current=state.walkArrangement?.original??null;wasGrabbing.current=grabbing;editStickReady.current=false}
    const pressed=keys.current
    let forward=(pressed.has('w')||pressed.has('arrowup')?1:0)-(pressed.has('s')||pressed.has('arrowdown')?1:0)
    let right=(pressed.has('d')||pressed.has('arrowright')?1:0)-(pressed.has('a')||pressed.has('arrowleft')?1:0)
    let sprint=pressed.has('shift')
    const gamepad=focused.current?navigator.getGamepads?.().find((entry):entry is Gamepad=>Boolean(entry?.connected&&entry.mapping==='standard')):undefined
    let jumpPressed=false,pickPressed=false,dropPressed=false,markPressed=false,viewHeld=false,zoom=0,slideAlong=0,slideAway=0,nudgeAlong=0,nudgeAway=0
    let suppressActions=state.wheelOpen
    if(gamepad){
      const identity=`${gamepad.index}:${gamepad.id}`
      if(identity!==padId.current){previousButtons.current=null;padId.current=identity;sweepReady.current=false;sweepActive.current=false;sweepVisited.current.clear()}
      right+=applyStickDeadzone(gamepad.axes[0]??0)
      forward-=applyStickDeadzone(gamepad.axes[1]??0)
      const buttons=gamepad.buttons.map(button=>button.pressed||button.value>.55)
      const edges=buttonEdges(buttons,previousButtons.current)
      if(!buttons[8])sweepReady.current=true
      viewHeld=Boolean(buttons[8]&&previousButtons.current&&sweepReady.current)
      if(state.walkDeleteId){
        previousButtons.current=buttons
        if(edges[1])state.cancelWalkDelete();else if(edges[0])state.confirmWalkDelete()
        return
      }
      if(!buttons[4])wheelBlocked.current=false
      const wheelHeld=Boolean(buttons[4]&&previousButtons.current&&!wheelBlocked.current)
      const wasWheel=state.wheelOpen
      if(wheelHeld){
        const index=wheelSector(gamepad.axes[2]??0,gamepad.axes[3]??0)
        if(!wasWheel||index!==state.wheelIndex)usePlannerStore.setState({wheelOpen:true,wheelIndex:index})
      }else if(wasWheel&&previousButtons.current?.[4]&&!buttons[4]){
        state.chooseEquipment(state.wheelIndex,camera.position.x-Math.sin(yaw.current)*12,-camera.position.z+Math.cos(yaw.current)*12,yaw.current)
      }
      suppressActions=wasWheel||Boolean(buttons[4])
      if(suppressActions){forward=0;right=0}
      zoom=suppressActions?0:gamepad.buttons[6]?.value??0
      if(editing){
        if(buttons[5]||viewHeld||suppressActions)editStickReady.current=false
        else if(lookStick(gamepad.axes[2]??0,state.lookDeadzone)===0&&lookStick(gamepad.axes[3]??0,state.lookDeadzone)===0)editStickReady.current=true
      }
      if(!suppressActions&&editing&&!grabbing&&!buttons[5]&&!viewHeld){
        if(editStickReady.current){slideAlong=lookStick(gamepad.axes[2]??0,state.lookDeadzone)*4*delta*(zoom>.15?.3:1);slideAway=-lookStick(gamepad.axes[3]??0,state.lookDeadzone)*4*delta*(zoom>.15?.3:1)}
      }else if(!suppressActions){
        yaw.current-=lookStick(gamepad.axes[2]??0,state.lookDeadzone)*2.1*delta*(zoom>.15?.65:1)
        pitch.current=MathUtils.clamp(pitch.current-lookStick(gamepad.axes[3]??0,state.lookDeadzone)*1.7*delta*(zoom>.15?.65:1),-Math.PI*.47,Math.PI*.47)
      }
      jumpPressed=!suppressActions&&!viewHeld&&edges[0]
      pickPressed=!suppressActions&&!viewHeld&&edges[2]
      dropPressed=!suppressActions&&!viewHeld&&edges[7]
      markPressed=!suppressActions&&edges[9]
      const mask=(buttons[12]?1:0)|(buttons[13]?2:0)|(buttons[14]?4:0)|(buttons[15]?8:0)
      if(!mask||suppressActions||viewHeld){dpadRepeat.current={mask:0,elapsed:0,next:.36}}
      else if(editing||(carry&&!carry.speciesId)){
        const fresh=[12,13,14,15].some(i=>edges[i]),repeat=dpadRepeat.current
        if(fresh){dpadRepeat.current={mask,elapsed:0,next:.36}}
        else if(repeat.mask===mask)repeat.elapsed+=delta
        if(fresh||(repeat.mask===mask&&repeat.elapsed>=repeat.next)){
          if(!fresh)repeat.next+=.14
          nudgeAlong=Number(Boolean(mask&8))-Number(Boolean(mask&4));nudgeAway=Number(Boolean(mask&1))-Number(Boolean(mask&2))
        }
      }else dpadRepeat.current={mask:0,elapsed:0,next:.36}
      previousButtons.current=buttons
      sprint=sprint||Boolean(gamepad.buttons[10]?.pressed)
      const exitPressed=Boolean(gamepad.buttons[1]?.pressed)
      if(edges[1]){
        if(suppressActions){wheelBlocked.current=true;usePlannerStore.setState({wheelOpen:false,wheelIndex:null,walkPrompt:'Wheel closed'});return}
        if(editing){state.cancelArrangement();return}
        if(carry){usePlannerStore.setState({walkCarry:null,walkPrompt:'Cancelled'});return}
        if(viewHeld){sweepReady.current=false;state.cancelArrangement(true);usePlannerStore.setState({walkSelecting:false});return}
        if(state.walkMarked.length){state.cancelArrangement(true);return}
        document.exitPointerLock?.();setViewMode('garden')
      }
      controllerExitPressed.current=exitPressed
    }else{
      if(padId.current){usePlannerStore.setState({walkCarry:null,walkArrangement:null,walkMarked:[],walkTargetId:null,walkSelecting:false,walkDeleteId:null,walkInspectId:null,wheelOpen:false,wheelIndex:null});padId.current=null;previousButtons.current=null;dpadRepeat.current={mask:0,elapsed:0,next:.36};if(camera instanceof PerspectiveCamera){camera.fov=72;camera.updateProjectionMatrix()}return}
      previousButtons.current=null;controllerExitPressed.current=false
    }
    if(state.walkDeleteId)return
    const selecting=viewHeld&&!suppressActions&&!editing&&!carry
    if(viewHeld&&!sweepActive.current)sweepVisited.current.clear()
    sweepActive.current=viewHeld
    if(state.walkSelecting!==selecting)usePlannerStore.setState({walkSelecting:selecting})
    if(suppressActions){forward=0;right=0}
    if(camera instanceof PerspectiveCamera){const target=zoom>.15?54:72;camera.fov=MathUtils.damp(camera.fov,target,18,delta);if(Math.abs(camera.fov-target)<.01)camera.fov=target;camera.updateProjectionMatrix()}
    if(usePlannerStore.getState().viewMode!=='walk')return
    camera.rotation.set(pitch.current,yaw.current,0,'YXZ')
    const moving=Math.abs(forward)+Math.abs(right)>.01
    if(moving){
      const movement=walkDelta(forward,right,yaw.current,(sprint?22:12)*delta)
      const nextX=camera.position.x+movement.x
      const nextZ=camera.position.z+movement.z
      if(isWalkPositionAllowed(nextX,camera.position.z,obstacles))camera.position.x=nextX
      if(isWalkPositionAllowed(camera.position.x,nextZ,obstacles))camera.position.z=nextZ
      stride.current+=delta*(sprint?12:8)
    }
    jump.current=jumpStep(jump.current.height,jump.current.velocity,delta,jumpPressed)
    camera.position.y=groundHeight(camera.position.x,-camera.position.z)+EYE_HEIGHT_FT+jump.current.height+(moving?Math.sin(stride.current)*.055:0)
    if(state.viewMode!=='walk')return
    const xFt=camera.position.x-Math.sin(yaw.current)*12,zFt=-(camera.position.z-Math.cos(yaw.current)*12)
    if(aimRef)aimRef.current={xFt,zFt}
    const pose={xFt:camera.position.x,zFt:-camera.position.z,heightFt:camera.position.y,yaw:yaw.current,pitch:pitch.current}
    if(aimRef)aimRef.player=pose
    if(suppressActions)return
    if(editing){
      if(pickPressed||dropPressed){state.applyArrangement();return}
      if(grabbing){if(nudgeAlong||nudgeAway)state.moveArrangement(nudgeAlong,nudgeAway,true);else if(!viewHeld)state.updateGrab(pose);return}
      if(slideAlong||slideAway)state.moveArrangement(slideAlong,slideAway)
      if(nudgeAlong||nudgeAway)state.moveArrangement(nudgeAlong,nudgeAway,true)
      return
    }
    if(pickPressed&&state.walkMarked.length){state.grabPlants(undefined,pose);return}
    if(carry){
      if(viewHeld)return
      if((nudgeAlong||nudgeAway)&&!carry.speciesId){state.startArrangement([carry.id],yaw.current);state.moveArrangement(nudgeAlong,nudgeAway,true);return}
      if(pickPressed||dropPressed){
        // Commit the same position the plant preview and distance guides show.
        // Sampling a newer camera aim here can otherwise jump beyond the guide.
        state.dropCarried(carry.xFt,carry.zFt,camera.position.x,-camera.position.z)
        return
      }
      const error=placementError(xFt,zFt)
      const prompt=error??'X / RT place here · B cancels'
      hudClock.current+=delta
      if(hudClock.current>.08){hudClock.current=0;usePlannerStore.setState({walkCarry:{...carry,xFt,zFt},walkPrompt:prompt})}
    }else{
      ray.current.setFromCamera(new Vector2(0,0),camera)
      ray.current.far=65
      const aimed=aimedPlant(ray.current.intersectObjects(scene.children,true))
      const plant=state.design.plants.find(p=>p.id===aimed)
      const prompt=plant?`${catalogById.get(plant.speciesId)?.commonName??'Plant'} · Menu ${state.walkMarked.includes(plant.id)?'deselects':'selects'} · X ${state.walkMarked.length?'grabs selection':'grabs'}`:state.walkMarked.length?`${state.walkMarked.length} selected · LB opens ${state.walkMarked.length===1?'plant actions':'alignment tools'}`:'Hold View and aim to select · Menu toggles one plant'
      if(prompt!==state.walkPrompt||state.walkTargetId!==(plant?.id??null))usePlannerStore.setState({walkPrompt:prompt,walkTargetId:plant?.id??null})
      if(markPressed&&plant){sweepVisited.current.add(plant.id);state.toggleWalkMark(plant.id);return}
      if(selecting&&plant&&!sweepVisited.current.has(plant.id)){sweepVisited.current.add(plant.id);state.selectWalkPlant(plant.id);return}
      if(pickPressed&&plant)state.grabPlants([plant.id],pose)
    }
  })
  return null
}
