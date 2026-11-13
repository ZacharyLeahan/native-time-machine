/* eslint-disable react-hooks/immutability -- R3F camera controls intentionally mutate Three.js objects each frame. */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { MathUtils } from 'three'
import { applyStickDeadzone, isWalkPositionAllowed, walkDelta, type WalkObstacle } from '../simulation/walkNavigation'
import { usePlannerStore } from '../store/usePlannerStore'
import { groundHeight } from '../simulation/surface'

const EYE_HEIGHT_FT=5.6
const START_POSITION={x:0,z:95}

export function WalkControls({obstacles}:{obstacles:readonly WalkObstacle[]}) {
  const {camera,gl}=useThree()
  const resetKey=usePlannerStore((state)=>state.cameraResetKey)
  const setViewMode=usePlannerStore((state)=>state.setViewMode)
  const keys=useRef(new Set<string>())
  const yaw=useRef(0)
  const pitch=useRef(0)
  const stride=useRef(0)
  const controllerExitPressed=useRef(false)
  const draggingLook=useRef(false)

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
    const clearKeys=()=>keys.current.clear()
    canvas.addEventListener('click',lockMouse)
    canvas.addEventListener('pointerdown',startDrag)
    ownerDocument.addEventListener('pointerup',endDrag)
    ownerDocument.addEventListener('mousemove',mouseMove)
    window.addEventListener('keydown',keyDown)
    window.addEventListener('keyup',keyUp)
    window.addEventListener('blur',clearKeys)
    return()=>{
      canvas.removeEventListener('click',lockMouse)
      canvas.removeEventListener('pointerdown',startDrag)
      ownerDocument.removeEventListener('pointerup',endDrag)
      ownerDocument.removeEventListener('mousemove',mouseMove)
      window.removeEventListener('keydown',keyDown)
      window.removeEventListener('keyup',keyUp)
      window.removeEventListener('blur',clearKeys)
      if(ownerDocument.pointerLockElement===canvas)ownerDocument.exitPointerLock?.()
    }
  },[camera,gl,setViewMode])

  useEffect(()=>{
    camera.position.set(START_POSITION.x,EYE_HEIGHT_FT,START_POSITION.z)
    yaw.current=0
    pitch.current=0
  },[camera,resetKey])

  useFrame((_,rawDelta)=>{
    const delta=Math.min(rawDelta,.05)
    const pressed=keys.current
    let forward=(pressed.has('w')||pressed.has('arrowup')?1:0)-(pressed.has('s')||pressed.has('arrowdown')?1:0)
    let right=(pressed.has('d')||pressed.has('arrowright')?1:0)-(pressed.has('a')||pressed.has('arrowleft')?1:0)
    let sprint=pressed.has('shift')
    const gamepad=navigator.getGamepads?.().find((entry):entry is Gamepad=>Boolean(entry))
    if(gamepad){
      right+=applyStickDeadzone(gamepad.axes[0]??0)
      forward-=applyStickDeadzone(gamepad.axes[1]??0)
      yaw.current-=applyStickDeadzone(gamepad.axes[2]??0)*2.1*delta
      pitch.current=MathUtils.clamp(pitch.current-applyStickDeadzone(gamepad.axes[3]??0)*1.7*delta,-Math.PI*.47,Math.PI*.47)
      sprint=sprint||Boolean(gamepad.buttons[10]?.pressed)
      const exitPressed=Boolean(gamepad.buttons[1]?.pressed)
      if(exitPressed&&!controllerExitPressed.current){document.exitPointerLock?.();setViewMode('garden')}
      controllerExitPressed.current=exitPressed
    }
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
    camera.position.y=groundHeight(camera.position.x,-camera.position.z)+EYE_HEIGHT_FT+(moving?Math.sin(stride.current)*.055:0)
  })
  return null
}
