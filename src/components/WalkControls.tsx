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

const EYE_HEIGHT_FT=5.6
const START_POSITION={x:0,z:95}

export function WalkControls({obstacles}:{obstacles:readonly WalkObstacle[]}) {
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

  useEffect(()=>{
    camera.rotation.order='YXZ'
    camera.position.set(START_POSITION.x,EYE_HEIGHT_FT,START_POSITION.z)
    yaw.current=0
    pitch.current=0
    camera.rotation.set(0,0,0,'YXZ')

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
      if(usePlannerStore.getState().wheelOpen)return
      if(ownerDocument.pointerLockElement!==canvas&&!draggingLook.current)return
      yaw.current-=event.movementX*.0021
      pitch.current=MathUtils.clamp(pitch.current-event.movementY*.0021,-Math.PI*.47,Math.PI*.47)
    }
    const keyDown=(event:KeyboardEvent)=>{
      const key=event.key.toLowerCase()
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)){event.preventDefault();keys.current.add(key)}
      if(key==='q'){
        if(ownerDocument.pointerLockElement===canvas)ownerDocument.exitPointerLock?.()
        setViewMode('garden')
      }
    }
    const keyUp=(event:KeyboardEvent)=>keys.current.delete(event.key.toLowerCase())
    const clearKeys=()=>{keys.current.clear();draggingLook.current=false;focused.current=false;previousButtons.current=null;usePlannerStore.setState({walkCarry:null,wheelOpen:false,wheelIndex:null})}
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
      usePlannerStore.setState({walkCarry:null,wheelOpen:false,wheelIndex:null})
      if(ownerDocument.pointerLockElement===canvas)ownerDocument.exitPointerLock?.()
    }
  },[camera,gl,setViewMode])

  useEffect(()=>{
    camera.position.set(START_POSITION.x,EYE_HEIGHT_FT,START_POSITION.z)
    yaw.current=0
    pitch.current=0
    jump.current={height:0,velocity:0}
    usePlannerStore.setState({walkCarry:null,wheelOpen:false,wheelIndex:null})
  },[camera,resetKey])

  useFrame((_,rawDelta)=>{
    const delta=Math.min(rawDelta,.05)
    const state=usePlannerStore.getState()
    const carry=state.walkCarry
    const pressed=keys.current
    let forward=(pressed.has('w')||pressed.has('arrowup')?1:0)-(pressed.has('s')||pressed.has('arrowdown')?1:0)
    let right=(pressed.has('d')||pressed.has('arrowright')?1:0)-(pressed.has('a')||pressed.has('arrowleft')?1:0)
    let sprint=pressed.has('shift')
    const gamepad=focused.current?navigator.getGamepads?.().find((entry):entry is Gamepad=>Boolean(entry?.connected&&entry.mapping==='standard')):undefined
    let jumpPressed=false,pickPressed=false,dropPressed=false,zoom=0
    let suppressActions=state.wheelOpen
    if(gamepad){
      const identity=`${gamepad.index}:${gamepad.id}`
      if(identity!==padId.current){previousButtons.current=null;padId.current=identity}
      right+=applyStickDeadzone(gamepad.axes[0]??0)
      forward-=applyStickDeadzone(gamepad.axes[1]??0)
      const buttons=gamepad.buttons.map(button=>button.pressed||button.value>.55)
      const edges=buttonEdges(buttons,previousButtons.current)
      if(!buttons[4])wheelBlocked.current=false
      const wheelHeld=Boolean(buttons[4]&&previousButtons.current&&!wheelBlocked.current)
      const wasWheel=state.wheelOpen
      if(wheelHeld){
        const index=wheelSector(gamepad.axes[2]??0,gamepad.axes[3]??0)
        if(!wasWheel||index!==state.wheelIndex)usePlannerStore.setState({wheelOpen:true,wheelIndex:index})
      }else if(wasWheel&&previousButtons.current?.[4]&&!buttons[4]){
        state.chooseEquipment(state.wheelIndex,camera.position.x-Math.sin(yaw.current)*12,-camera.position.z+Math.cos(yaw.current)*12)
      }
      suppressActions=wasWheel||Boolean(buttons[4])
      if(suppressActions){forward=0;right=0}
      zoom=suppressActions?0:gamepad.buttons[6]?.value??0
      if(!suppressActions){
        yaw.current-=lookStick(gamepad.axes[2]??0,state.lookDeadzone)*2.1*delta*(zoom>.15?.65:1)
        pitch.current=MathUtils.clamp(pitch.current-lookStick(gamepad.axes[3]??0,state.lookDeadzone)*1.7*delta*(zoom>.15?.65:1),-Math.PI*.47,Math.PI*.47)
      }
      jumpPressed=!suppressActions&&edges[0]
      pickPressed=!suppressActions&&edges[2]
      dropPressed=!suppressActions&&edges[7]
      previousButtons.current=buttons
      sprint=sprint||Boolean(gamepad.buttons[10]?.pressed)
      const exitPressed=Boolean(gamepad.buttons[1]?.pressed)
      if(edges[1]){
        if(suppressActions||carry){wheelBlocked.current=true;usePlannerStore.setState({wheelOpen:false,wheelIndex:null,walkCarry:null,walkPrompt:'Cancelled'});return}
        document.exitPointerLock?.();setViewMode('garden')
      }
      controllerExitPressed.current=exitPressed
    }else{
      if(padId.current){usePlannerStore.setState({walkCarry:null,wheelOpen:false,wheelIndex:null});padId.current=null;previousButtons.current=null;if(camera instanceof PerspectiveCamera){camera.fov=72;camera.updateProjectionMatrix()}return}
      previousButtons.current=null;controllerExitPressed.current=false
    }
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
    if(suppressActions)return
    const xFt=camera.position.x-Math.sin(yaw.current)*12,zFt=-(camera.position.z-Math.cos(yaw.current)*12)
    if(carry){
      const error=placementError(xFt,zFt)
      const prompt=error??'X / RT place here · B cancels'
      hudClock.current+=delta
      if(hudClock.current>.08){hudClock.current=0;usePlannerStore.setState({walkCarry:{...carry,xFt,zFt},walkPrompt:prompt})}
      if(pickPressed||dropPressed){
        if(error){usePlannerStore.setState({walkPrompt:error});return}
        // Move once on drop, preserving normal validation and one undo step.
        state.dropCarried(xFt,zFt,camera.position.x,-camera.position.z)
      }
    }else{
      ray.current.setFromCamera(new Vector2(0,0),camera)
      ray.current.far=65
      const aimed=aimedPlant(ray.current.intersectObjects(scene.children,true))
      const plant=state.design.plants.find(p=>p.id===aimed)
      const prompt=plant?`X pick up ${catalogById.get(plant.speciesId)?.commonName??'plant'}`:'Aim at a plant · X picks up'
      if(prompt!==state.walkPrompt)usePlannerStore.setState({walkPrompt:prompt})
      if(pickPressed&&plant)usePlannerStore.setState({walkCarry:{id:plant.id,xFt:plant.xFt,zFt:plant.zFt},selectedPlantId:plant.id})
    }
  })
  return null
}
