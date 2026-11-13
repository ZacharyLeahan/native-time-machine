import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from 'three'
import { defaultDesign, serializeDesign } from '../persistence/design'
import { DEFAULT_FAVORITES } from '../persistence/favorites'
import { usePlannerStore as store } from '../store/usePlannerStore'
import { WalkControls } from './WalkControls'
import { EquipmentWheel } from './EquipmentWheel'
import { measurePlacement,measurementSubject } from '../simulation/measurements'

// Run the real Walk frame callback with deterministic hardware and Three.js objects.
// React/R3F scheduling is replaced; navigation, raycasting and store actions are real.
const harness=vi.hoisted(()=>({frame:(()=>{}) as (state:unknown,delta:number)=>void,cleanups:[] as (()=>void)[],three:{} as Record<string,unknown>}))
vi.mock('react',()=>({
  useRef:(current:unknown)=>({current}),
  useEffect:(effect:()=>void|(()=>void))=>{const cleanup=effect();if(cleanup)harness.cleanups.push(cleanup)},
}))
vi.mock('@react-three/fiber',()=>({useFrame:(frame:typeof harness.frame)=>{harness.frame=frame},useThree:()=>harness.three}))
vi.mock('../store/usePlannerStore',async original=>{
  const {usePlannerStore:actual}=await original<typeof import('../store/usePlannerStore')>()
  return {usePlannerStore:Object.assign((select:(state:ReturnType<typeof actual.getState>)=>unknown)=>select(actual.getState()),{getState:actual.getState,setState:actual.setState})}
})

let camera:PerspectiveCamera,scene:Scene,pad:Gamepad & {axes:number[]},pads:(Gamepad|null)[],win:EventTarget
function frame(count=1){for(let i=0;i<count;i++)harness.frame({},1/60)}
function button(index:number,pressed:boolean){(pad.buttons as GamepadButton[])[index]={pressed,touched:pressed,value:pressed?1:0}}
function setup(){WalkControls({obstacles:[]});frame()}
beforeEach(()=>{
  store.setState({viewMode:'walk',design:{...defaultDesign,plants:[]},favorites:[...DEFAULT_FAVORITES],past:[],future:[],moveBaseline:null,walkCarry:null,wheelOpen:false,wheelIndex:null,selectedPlantId:null,walkPrompt:'',cameraShortcut:null})
  camera=new PerspectiveCamera(72,1,.05,700);scene=new Scene();win=new EventTarget()
  const doc=Object.assign(new EventTarget(),{pointerLockElement:null,exitPointerLock:vi.fn()})
  const canvas=Object.assign(new EventTarget(),{ownerDocument:doc,requestPointerLock:()=>Promise.resolve()})
  harness.three={camera,scene,gl:{domElement:canvas}}
  pad={index:0,id:'QA Xbox',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))} as unknown as Gamepad & {axes:number[]}
  pads=[pad]
  vi.stubGlobal('window',win);vi.stubGlobal('document',doc);vi.stubGlobal('navigator',{getGamepads:()=>pads})
})
afterEach(()=>{harness.cleanups.splice(0).reverse().forEach(cleanup=>cleanup());vi.unstubAllGlobals()})

describe('Xbox Walk frame integration',()=>{
  it('excludes the original trunk while measuring an existing tree carried with X',()=>{
    store.getState().placePlant('white-oak',0,0);store.getState().placePlant('red-maple',20,0)
    const design=store.getState().design,id=design.plants[0].id
    setup();camera.position.set(0,5.6,10)
    const geometry=new BoxGeometry(4,10,4),material=new MeshBasicMaterial(),tree=new Mesh(geometry,material)
    tree.position.y=5;tree.userData.plantId=id;scene.add(tree);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true)
    button(2,true);frame();button(2,false);frame(6)
    const carry=store.getState().walkCarry!,measurement=measurePlacement(carry,design.plants,[{xFt:-20,zFt:-20},{xFt:30,zFt:-20},{xFt:30,zFt:30},{xFt:-20,zFt:30}])
    expect(carry.id).toBe(id);expect(carry.zFt).toBeCloseTo(2)
    expect(measurement.neighbor?.plant.id).toBe(design.plants[1].id)
    expect(measurement.neighbor?.distanceFt).toBeCloseTo(Math.sqrt(404))
    expect(store.getState().design).toBe(design)
    geometry.dispose();material.dispose()
  })
  it.each([30,60,144])('drops at the displayed measurement position while moving at %i fps',fps=>{
    setup();camera.position.set(0,5.6,10);store.getState().chooseEquipment(1,0,0);frame(6)
    const original=store.getState().design,preview={...store.getState().walkCarry!}
    pad.axes[1]=-1;button(10,true);harness.frame({},1/fps)
    button(7,true);harness.frame({},1/fps)
    const planted=store.getState().design.plants[0]
    expect(planted.xFt).toBe(preview.xFt);expect(planted.zFt).toBe(preview.zFt)
    expect(planted.zFt).not.toBeCloseTo(-camera.position.z+12,2)
    expect(store.getState().past).toHaveLength(1)
    store.getState().undo();expect(store.getState().design).toBe(original)
  })
  it('anchors a mouse-selected wheel preview at the current Walk aim on its first render',()=>{
    const aimRef={current:{xFt:999,zFt:999}}
    WalkControls({obstacles:[],aimRef});frame()
    camera.position.set(20,5.6,20);pad.axes[2]=.8;frame(10);pad.axes.fill(0)
    store.setState({wheelOpen:true,wheelIndex:null});frame()
    const aim={...aimRef.current},design=store.getState().design
    expect(aim.xFt).toBeCloseTo(camera.position.x-Math.sin(camera.rotation.y)*12)
    expect(aim.zFt).toBeCloseTo(-camera.position.z+Math.cos(camera.rotation.y)*12)
    const wheel=EquipmentWheel({aimRef})!
    const options=wheel.props.children[1] as {props:{onClick:()=>void}}[]
    options[0].props.onClick()
    expect(store.getState().walkCarry).toMatchObject(aim)
    expect(store.getState().design).toBe(design)
    expect(aim.xFt).not.toBe(0);expect(aim.zFt).not.toBe(-85)
  })
  it('feeds live carry measurements as the controller moves while leaving saved positions intact',()=>{
    store.getState().placePlant('white-oak',0,0)
    const design=store.getState().design
    setup();camera.position.set(0,5.6,10);store.getState().chooseEquipment(1,0,0);frame(6)
    const currentMeasurement=()=>{
      const state=store.getState(),subject=measurementSubject(state.design.plants,state.selectedPlantId,state.walkCarry,state.viewMode)!
      return measurePlacement(subject,state.design.plants,[{xFt:-20,zFt:-20},{xFt:20,zFt:-20},{xFt:20,zFt:20},{xFt:-20,zFt:20}])
    }
    const before=currentMeasurement()
    pad.axes[1]=-1;frame(12)
    const after=currentMeasurement()
    expect(after.neighbor?.distanceFt).toBeGreaterThan(before.neighbor!.distanceFt)
    expect(after.boundary?.distanceFt).toBeLessThan(before.boundary!.distanceFt)
    expect(store.getState().design).toBe(design)
  })
  it('allows Escape to dismiss the equipment overlay without committing a preview',()=>{
    setup();store.getState().chooseEquipment(0,0,0)
    const design=store.getState().design,carry=store.getState().walkCarry
    store.setState({wheelOpen:true,wheelIndex:1});EquipmentWheel({aimRef:{current:{xFt:0,zFt:0}}})
    win.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{key:'Escape'}))
    expect(store.getState().wheelOpen).toBe(false)
    expect(store.getState().walkCarry).toBe(carry);expect(store.getState().design).toBe(design)
  })
  it('selects a favorite with LB/RS, suppresses movement and aim, and requires a fresh trigger press to plant once',()=>{
    store.setState({favorites:['pawpaw']});setup()
    const before=serializeDesign(store.getState().design),rotation=camera.rotation.clone(),position=camera.position.clone()
    button(4,true);button(7,true);pad.axes[1]=-1;pad.axes[3]=-1;frame(30)
    expect(store.getState().wheelIndex).toBe(0)
    expect(camera.position.distanceTo(position)).toBeLessThan(.1)
    expect(camera.rotation.y).toBe(rotation.y);expect(camera.rotation.x).toBe(rotation.x)
    button(4,false);pad.axes.fill(0);frame(2)
    expect(store.getState().walkCarry?.speciesId).toBe('pawpaw')
    expect(serializeDesign(store.getState().design)).toBe(before)
    camera.position.set(0,5.6,10);frame(6)
    button(7,false);frame();button(7,true);frame(30)
    expect(store.getState().design.plants).toHaveLength(1)
    expect(store.getState().design.plants[0].speciesId).toBe('pawpaw')
    expect(store.getState().past).toHaveLength(1)
    store.getState().undo();expect(serializeDesign(store.getState().design)).toBe(before)
  })
  it('B cancels a held-open wheel without reopening it or modifying the design',()=>{
    setup();const original=store.getState().design
    button(4,true);pad.axes[3]=-1;frame();button(1,true);frame();button(1,false);frame(20)
    expect(store.getState().wheelOpen).toBe(false);expect(store.getState().walkCarry).toBeNull()
    expect(store.getState().viewMode).toBe('walk');expect(store.getState().design).toBe(original)
    button(4,false);frame();button(4,true);frame();expect(store.getState().wheelOpen).toBe(true)
  })
  it('handles neutral and empty wheel sectors without equipping a plant',()=>{
    store.setState({favorites:[]});setup()
    button(4,true);pad.axes[3]=-1;frame();button(4,false);frame(2)
    expect(store.getState().walkCarry).toBeNull();expect(store.getState().wheelOpen).toBe(false)
    button(4,true);pad.axes.fill(0);frame();button(4,false);frame(2)
    expect(store.getState().design.plants).toHaveLength(0)
  })
  it('moves, zooms, jumps, and stops aim immediately when RS returns to neutral',()=>{
    setup();const start=camera.position.clone()
    pad.axes[1]=-1;pad.axes[2]=.8;frame(12)
    expect(camera.position.distanceTo(start)).toBeGreaterThan(1)
    const yaw=camera.rotation.y;pad.axes.fill(0);frame(30);expect(camera.rotation.y).toBe(yaw)
    button(6,true);frame(30);expect(camera.fov).toBeLessThan(55)
    const floor=camera.position.y;button(0,true);frame();expect(camera.position.y).toBeGreaterThan(floor)
    button(0,false);button(6,false);frame(100);expect(camera.fov).toBe(72)
  })
  it('picks up a nested plant mesh with X and drops with X as one undoable move',()=>{
    store.getState().placePlant('white-oak',0,0);const original=store.getState().design
    setup();camera.position.set(0,5.6,10)
    const geometry=new BoxGeometry(4,10,4),material=new MeshBasicMaterial(),tree=new Mesh(geometry,material)
    tree.position.y=5;tree.userData.plantId=original.plants[0].id;scene.add(tree);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true)
    button(2,true);frame();expect(store.getState().walkCarry?.id).toBe(original.plants[0].id)
    expect(store.getState().design).toBe(original)
    button(2,false);frame(6);button(2,true);frame()
    expect(store.getState().walkCarry).toBeNull();expect(store.getState().design.plants[0].zFt).toBeCloseTo(2)
    store.getState().undo();expect(store.getState().design).toBe(original)
    geometry.dispose();material.dispose()
  })
  it('cancels a preview on disconnect or focus loss and ignores held buttons on reconnect',()=>{
    setup();store.getState().chooseEquipment(0,0,0);button(6,true);frame(20)
    pads=[];frame();expect(store.getState().walkCarry).toBeNull();expect(camera.fov).toBe(72)
    pads=[pad];button(2,true);frame();expect(store.getState().design.plants).toHaveLength(0)
    store.getState().chooseEquipment(0,0,0);win.dispatchEvent(new Event('blur'));frame()
    expect(store.getState().walkCarry).toBeNull();expect(store.getState().wheelOpen).toBe(false)
    win.dispatchEvent(new Event('focus'));frame();expect(store.getState().design.plants).toHaveLength(0)
  })
})
