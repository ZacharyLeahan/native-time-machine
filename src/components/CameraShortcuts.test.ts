import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { PerspectiveCamera } from 'three'
import { OrbitControls } from 'three-stdlib'
import { usePlannerStore as store } from '../store/usePlannerStore'
import { CameraShortcutsRig } from './CameraShortcuts'
import { cameraShot } from '../simulation/cameraShots'
import { defaultDesign } from '../persistence/design'

const harness=vi.hoisted(()=>({frame:(()=>{}) as (state:unknown,delta:number)=>void,cleanups:[] as (()=>void)[],three:{} as Record<string,unknown>}))
vi.mock('react',()=>({useRef:(current:unknown)=>({current}),useEffect:(effect:()=>void|(()=>void))=>{const cleanup=effect();if(cleanup)harness.cleanups.push(cleanup)}}))
vi.mock('@react-three/fiber',()=>({useFrame:(frame:typeof harness.frame)=>{harness.frame=frame},useThree:()=>harness.three}))
vi.mock('../store/usePlannerStore',async original=>{
  const {usePlannerStore:actual}=await original<typeof import('../store/usePlannerStore')>()
  return {usePlannerStore:Object.assign((select:(state:ReturnType<typeof actual.getState>)=>unknown)=>select(actual.getState()),{getState:actual.getState,setState:actual.setState})}
})
let camera:PerspectiveCamera,orbit:OrbitControls
function frame(count=1){for(let i=0;i<count;i++){harness.frame({},1/60);orbit.update()}}
beforeEach(()=>{
  store.setState({viewMode:'garden',design:{...defaultDesign,plants:[]},past:[],future:[],moveBaseline:null,selectedPlantId:null,cameraShortcut:null})
  camera=new PerspectiveCamera(44,1,.1,700);camera.position.set(170,125,190)
  orbit=new OrbitControls(camera);orbit.maxDistance=420;orbit.maxPolarAngle=Math.PI*.48
  harness.three={camera,controls:orbit,size:{width:1280,height:720}}
})
afterEach(()=>{harness.cleanups.splice(0).reverse().forEach(cleanup=>cleanup());orbit.dispose()})
describe('camera shortcut integration with real OrbitControls',()=>{
  it('converges to a front view without changing the design',()=>{
    const design=store.getState().design
    store.getState().requestCamera('front');CameraShortcutsRig();frame(240)
    const shot=cameraShot('front',undefined,1280/720)
    camera.position.toArray().forEach((value,index)=>expect(value).toBeCloseTo(shot.position[index],6))
    expect(orbit.target.toArray()).toEqual(shot.target);expect(store.getState().design).toBe(design)
  })
  it('can finish a narrow-screen shot beyond the original orbit distance and far plane',()=>{
    camera.aspect=.25;harness.three.size={width:320,height:1280}
    store.getState().requestCamera('front');CameraShortcutsRig();frame(600)
    const shot=cameraShot('front',undefined,.25)
    expect(camera.position.distanceTo(orbit.target)).toBeCloseTo(Math.hypot(...shot.position.map((v,i)=>v-shot.target[i])),1)
    expect(camera.far).toBeGreaterThan(camera.position.distanceTo(orbit.target)+100)
  })
  it('clears the preset when manual camera control interrupts an animation',()=>{
    store.getState().requestCamera('left');CameraShortcutsRig();frame(3)
    orbit.dispatchEvent({type:'start',target:orbit})
    const position=camera.position.clone();frame(60)
    expect(camera.position.distanceTo(position)).toBeLessThan(.001)
    expect(store.getState().cameraShortcut).toBeNull()
  })
  it('frames the selected tree at its current growth year without moving that tree',()=>{
    store.getState().placePlant('white-oak',0,0)
    const design=store.getState().design,id=design.plants[0].id
    store.getState().setYear(0);store.getState().requestCamera('selected');CameraShortcutsRig();frame(240)
    const youngTarget=orbit.target.y,youngDistance=camera.position.distanceTo(orbit.target)
    harness.cleanups.splice(0).forEach(cleanup=>cleanup())
    store.getState().setYear(50);store.getState().requestCamera('selected');CameraShortcutsRig();frame(240)
    expect(orbit.target.y).toBeGreaterThan(youngTarget)
    expect(camera.position.distanceTo(orbit.target)).toBeGreaterThan(youngDistance)
    expect(orbit.target.x).toBe(0);expect(orbit.target.z).toBe(0)
    expect(store.getState().selectedPlantId).toBe(id);expect(store.getState().design).toBe(design)
  })
})
