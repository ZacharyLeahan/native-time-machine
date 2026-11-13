import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from 'three'
import { defaultDesign, serializeDesign } from '../persistence/design'
import { DEFAULT_FAVORITES } from '../persistence/favorites'
import { usePlannerStore as store } from '../store/usePlannerStore'
import { WalkControls } from './WalkControls'
import { EquipmentWheel } from './EquipmentWheel'
import { measurePlacement,measurementSubject } from '../simulation/measurements'
import { plantingCoordinates } from '../simulation/plantingGroup'
import { usePlacementMeasurements } from '../hooks/usePlacementMeasurements'
import { displayBoundary } from '../data/displayBoundary'

// Run the real Walk frame callback with deterministic hardware and Three.js objects.
// React/R3F scheduling is replaced; navigation, raycasting and store actions are real.
const harness=vi.hoisted(()=>({frame:(()=>{}) as (state:unknown,delta:number)=>void,cleanups:[] as (()=>void)[],three:{} as Record<string,unknown>}))
vi.mock('react',()=>({
  useRef:(current:unknown)=>({current}),
  useMemo:(factory:()=>unknown)=>factory(),
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
function selectionFixture(count=3){
  for(let i=0;i<count;i++)store.getState().placePlant('red-maple',i*10-10,0)
  store.setState({past:[],future:[]});setup()
  const original=store.getState().design,geometry=new BoxGeometry(4,16,4),material=new MeshBasicMaterial()
  original.plants.forEach(p=>{const mesh=new Mesh(geometry,material);mesh.position.set(p.xFt,8,0);mesh.userData.plantId=p.id;scene.add(mesh)})
  scene.updateMatrixWorld(true)
  const aim=(index:number)=>{camera.position.set(original.plants[index].xFt,5.6,10);camera.updateMatrixWorld(true)}
  aim(0)
  return {original,aim,dispose:()=>{geometry.dispose();material.dispose()}}
}
beforeEach(()=>{
  store.setState({walkMarked:[],walkArrangement:null,walkTargetId:null,walkSelecting:false,walkDeleteId:null,walkInspectId:null})
    store.setState({viewMode:'walk',design:{...defaultDesign,plants:[]},favorites:[...DEFAULT_FAVORITES],past:[],future:[],moveBaseline:null,walkCarry:null,wheelOpen:false,wheelIndex:null,selectedPlantId:null,walkPrompt:'',cameraShortcut:null,recordedBoundary:true,aerialAligned:true})
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
  it('requires a fresh View hold after focus returns',()=>{
    const test=selectionFixture();button(8,true);frame()
    win.dispatchEvent(new Event('blur'));win.dispatchEvent(new Event('focus'));frame(10)
    expect(store.getState().walkMarked).toHaveLength(0)
    button(8,false);frame();button(8,true);frame()
    expect(store.getState().walkMarked).toHaveLength(1);test.dispose()
  })
  it('ignores mouse look during delete review without a delayed camera jump',()=>{
    const test=selectionFixture(1),gl=harness.three.gl as {domElement:EventTarget & {ownerDocument:EventTarget}}
    gl.domElement.dispatchEvent(new Event('pointerdown'))
    store.getState().selectWalkPlant(test.original.plants[0].id);store.getState().selectionAction('delete')
    gl.domElement.ownerDocument.dispatchEvent(Object.assign(new Event('mousemove'),{movementX:100,movementY:100}))
    store.getState().cancelWalkDelete();frame()
    expect(camera.rotation.y).toBe(0);expect(camera.rotation.x).toBe(0);test.dispose()
  })
  it.each([30,60,144])('keeps actual measurement-hook distances on the displayed carried centers at %i fps',fps=>{
    const test=selectionFixture();store.getState().selectWalkPlant(test.original.plants[0].id)
    store.getState().selectWalkPlant(test.original.plants[1].id)
    button(2,true);frame();button(2,false)
    const saved=serializeDesign(test.original)
    pad.axes[1]=-.3;pad.axes[2]=.45;pad.axes[3]=-.3
    for(let i=0;i<fps/2;i++){
      harness.frame({},1/fps)
      for(const [recordedBoundary,aerialAligned] of [[true,true],[true,false],[false,false]]){
        store.setState({recordedBoundary,aerialAligned})
        // eslint-disable-next-line react-hooks/rules-of-hooks -- React scheduling is mocked above; sample the actual hook for each simulated render.
        const s=store.getState(),preview=s.walkArrangement!.preview,readout=usePlacementMeasurements().measurements!
        const subject=preview.find(p=>p.id===readout.subject.id)!
        expect(readout.subject).toEqual(subject)
        const plants=s.design.plants.map(p=>preview.find(q=>q.id===p.id)??p)
        const closest=Math.min(...plants.filter(p=>p.id!==subject.id).map(p=>Math.hypot(p.xFt-subject.xFt,p.zFt-subject.zFt)))
        expect(readout.neighbor!.distanceFt).toBeCloseTo(closest,10)
        const points=displayBoundary(recordedBoundary,aerialAligned).points
        // Independent cross-product distance oracle, including segment endpoints.
        const boundary=Math.min(...points.map((a,j)=>{
          const b=points[(j+1)%points.length],dx=b.xFt-a.xFt,dz=b.zFt-a.zFt,px=subject.xFt-a.xFt,pz=subject.zFt-a.zFt
          const dot=px*dx+pz*dz,len=dx*dx+dz*dz
          return dot<=0?Math.hypot(px,pz):dot>=len?Math.hypot(subject.xFt-b.xFt,subject.zFt-b.zFt):Math.abs(px*dz-pz*dx)/Math.sqrt(len)
        }))
        expect(readout.boundary!.distanceFt).toBeCloseTo(boundary,10)
      }
      expect(serializeDesign(store.getState().design)).toBe(saved)
    }
    pad.axes.fill(0)
    const displayed=store.getState().walkArrangement!.preview
    button(7,true);frame(5)
    expect(store.getState().walkArrangement).toBeNull()
    for(const p of displayed)expect(store.getState().design.plants.find(q=>q.id===p.id)).toEqual(p)
    expect(store.getState().past).toHaveLength(1);store.getState().undo()
    expect(serializeDesign(store.getState().design)).toBe(saved);test.dispose()
  })
  it('X grab follows walking, drops with RT, and restores the original with one undo',()=>{
    const test=selectionFixture(1);button(2,true);frame();button(2,false);frame()
    const position=camera.position.clone(),first=store.getState().walkArrangement!.preview[0]
    expect(first).toEqual(test.original.plants[0]);expect(store.getState().walkArrangement?.grab).toBeTruthy()
    pad.axes[1]=-1;frame(12);pad.axes.fill(0)
    const moved=store.getState().walkArrangement!.preview[0]
    expect(moved.zFt-first.zFt).toBeCloseTo(position.z-camera.position.z)
    expect(moved.zFt).not.toBe(first.zFt);expect(store.getState().design).toBe(test.original)
    button(7,true);frame();expect(store.getState().walkArrangement).toBeNull();expect(store.getState().design.plants[0].zFt).toBe(moved.zFt)
    expect(store.getState().past).toHaveLength(1);store.getState().undo();expect(store.getState().design).toBe(test.original);test.dispose()
  })
  it('a grabbed selection carries as a rigid formation and B cancels every preview position',()=>{
    const test=selectionFixture();test.original.plants.forEach(p=>store.getState().selectWalkPlant(p.id))
    button(2,true);frame();button(2,false);pad.axes[2]=.8;frame(15);pad.axes.fill(0)
    const points=store.getState().walkArrangement!.preview
    for(let i=1;i<points.length;i++){expect(points[i].xFt-points[0].xFt).toBeCloseTo(test.original.plants[i].xFt-test.original.plants[0].xFt);expect(points[i].zFt-points[0].zFt).toBeCloseTo(0)}
    button(1,true);frame();expect(store.getState().walkArrangement).toBeNull();expect(store.getState().design).toBe(test.original);test.dispose()
  })
  it('X grabs at the existing center, then camera look carries it without changing saved positions',()=>{
    const test=selectionFixture(1),plant=test.original.plants[0]
    store.getState().selectWalkPlant(plant.id);pad.axes[2]=.8;button(2,true);frame();button(2,false);pad.axes.fill(0);frame(20)
    expect(store.getState().walkArrangement!.preview[0]).toEqual(plant)
    const yaw=camera.rotation.y;pad.axes[2]=.8;frame(10);expect(camera.rotation.y).not.toBe(yaw)
    expect(store.getState().walkArrangement!.preview[0]).not.toEqual(plant);expect(store.getState().design).toBe(test.original);test.dispose()
  })
  it('Menu selection exposes distances without picking up or moving the plant',()=>{
    const test=selectionFixture();button(9,true);frame();button(9,false);frame(30)
    const s=store.getState(),subject=measurementSubject(s.design.plants,s.selectedPlantId,s.walkCarry,'walk',s.walkMarked,s.walkTargetId)!
    expect(subject).toBe(test.original.plants[0]);expect(s.walkArrangement).toBeNull();expect(s.walkCarry).toBeNull()
    expect(measurePlacement(subject,s.design.plants,[{xFt:-100,zFt:-100},{xFt:100,zFt:-100},{xFt:100,zFt:100},{xFt:-100,zFt:100}]).neighbor?.distanceFt).toBe(10)
    expect(s.design).toBe(test.original);expect(s.past).toHaveLength(0);test.dispose()
  })
  it('holds View to sweep-add three plants without toggling repeatedly or changing saved positions',()=>{
    const test=selectionFixture()
    button(8,true)
    for(let i=0;i<3;i++){test.aim(i);frame(20)}
    expect(store.getState().walkMarked).toEqual(test.original.plants.map(p=>p.id));expect(store.getState().walkSelecting).toBe(true)
    button(8,false);frame();expect(store.getState().walkSelecting).toBe(false)
    expect(store.getState().design).toBe(test.original);expect(store.getState().past).toHaveLength(0);test.dispose()
  })
  it('Menu deselects a swept plant and View does not immediately re-add it during that hold',()=>{
    const test=selectionFixture();button(8,true);frame(10)
    const id=test.original.plants[0].id
    expect(store.getState().walkMarked).toContain(id)
    button(9,true);frame(20);expect(store.getState().walkMarked).not.toContain(id)
    button(9,false);test.aim(1);frame();test.aim(0);frame(20)
    expect(store.getState().walkMarked).not.toContain(id)
    button(9,true);frame();expect(store.getState().walkMarked).toContain(id)
    test.dispose()
  })
  it('keeps a Menu deselection through opening and closing LB during the same View hold',()=>{
    const test=selectionFixture(1);button(8,true);frame();button(9,true);frame();button(9,false);frame()
    expect(store.getState().walkMarked).toHaveLength(0)
    button(4,true);frame();button(4,false);frame(10)
    expect(store.getState().walkMarked).toHaveLength(0);expect(store.getState().design).toBe(test.original);test.dispose()
  })
  it('stops adding when View is released and can add again during the next hold',()=>{
    const test=selectionFixture();button(8,true);frame();button(8,false);frame()
    test.aim(1);frame(20);expect(store.getState().walkMarked).toHaveLength(1)
    button(8,true);frame();expect(store.getState().walkMarked).toHaveLength(2);test.dispose()
  })
  it('requires View to be released after a held-button reconnect before sweep selection starts',()=>{
    const test=selectionFixture();pads=[];frame();button(8,true);pads=[pad];frame(20)
    expect(store.getState().walkMarked).toHaveLength(0)
    button(8,false);frame();button(8,true);frame();expect(store.getState().walkMarked).toHaveLength(1);test.dispose()
  })
  it('uses the single-selection delete sector and requires a fresh A press before deleting once',()=>{
    const test=selectionFixture(1);store.getState().selectWalkPlant(test.original.plants[0].id)
    button(0,true);frame();button(4,true);pad.axes[2]=-.9;pad.axes[3]=.55;frame(3)
    expect(store.getState().wheelIndex).toBe(4)
    button(4,false);pad.axes.fill(0);frame(3)
    expect(store.getState().walkDeleteId).toBe(test.original.plants[0].id);expect(store.getState().design).toBe(test.original)
    button(0,false);frame();button(0,true);frame(10)
    expect(store.getState().design.plants).toHaveLength(0);expect(store.getState().past).toHaveLength(1)
    store.getState().undo();expect(store.getState().design).toBe(test.original);test.dispose()
  })
  it('B cancels deletion while keeping the selected plant and staying in Walk',()=>{
    const test=selectionFixture(1);store.getState().selectWalkPlant(test.original.plants[0].id);store.getState().selectionAction('delete')
    button(1,true);frame()
    expect(store.getState().walkDeleteId).toBeNull();expect(store.getState().walkMarked).toHaveLength(1)
    expect(store.getState().design).toBe(test.original);expect(store.getState().viewMode).toBe('walk');test.dispose()
  })
  it('freezes movement during delete review and cancels it safely on focus loss',()=>{
    const test=selectionFixture(1);store.getState().selectWalkPlant(test.original.plants[0].id);store.getState().selectionAction('delete')
    const position=camera.position.clone(),rotation=camera.rotation.clone()
    pad.axes[1]=-1;pad.axes[2]=1;frame(20)
    expect(camera.position.distanceTo(position)).toBe(0);expect(camera.rotation.y).toBe(rotation.y)
    win.dispatchEvent(new Event('blur'));frame();expect(store.getState().walkDeleteId).toBeNull();expect(store.getState().design).toBe(test.original);test.dispose()
  })
  it('leaves Enter on a focused Cancel button to the button instead of applying the group',()=>{
    store.getState().placePlant('white-oak',0,0)
    const listeners=vi.spyOn(win,'addEventListener');setup()
    store.getState().startArrangement([store.getState().design.plants[0].id]);store.getState().moveArrangement(1,0)
    const original=store.getState().design,group=store.getState().walkArrangement
    class ButtonStub {isContentEditable=false;closest(selector:string){return selector==='button,summary'?this:null}}
    vi.stubGlobal('HTMLElement',ButtonStub)
    const handler=listeners.mock.calls.find(([type])=>type==='keydown')![1] as (e:KeyboardEvent)=>void
    handler({key:'Enter',target:new ButtonStub(),preventDefault:vi.fn()} as unknown as KeyboardEvent)
    expect(store.getState().design).toBe(original);expect(store.getState().walkArrangement).toBe(group)
  })
  it('marks three aimed plants with Menu, grabs with X, and routes RS/D-pad to a boundary-relative preview',()=>{
    for(const x of [-10,0,10])store.getState().placePlant('red-maple',x,0)
    store.setState({past:[],future:[]});setup()
    const original=store.getState().design,geometry=new BoxGeometry(4,16,4),material=new MeshBasicMaterial()
    for(const plant of original.plants){const tree=new Mesh(geometry,material);tree.position.set(plant.xFt,8,0);tree.userData.plantId=plant.id;scene.add(tree)}
    scene.updateMatrixWorld(true)
    for(const plant of original.plants){camera.position.set(plant.xFt,5.6,10);camera.updateMatrixWorld(true);button(9,true);frame();button(9,false);frame()}
    expect(store.getState().walkMarked).toHaveLength(3)
    button(2,true);frame();button(2,false);frame()
    expect(store.getState().walkArrangement?.preview).toHaveLength(3)
    const yaw=camera.rotation.y,preview=store.getState().walkArrangement!.preview
    pad.axes[2]=1;frame(30);pad.axes.fill(0)
    expect(camera.rotation.y).not.toBe(yaw);expect(store.getState().walkArrangement!.preview[0].xFt).not.toBe(preview[0].xFt)
    button(12,true);frame();button(12,false);frame()
    const group=store.getState().walkArrangement!,setback=Math.min(...group.preview.map(p=>plantingCoordinates(p,group.frame).away))
    expect(group.grab).toBeUndefined()
    expect(setback).toBeCloseTo(Math.round(setback));expect(store.getState().design).toBe(original);expect(store.getState().past).toHaveLength(0)
    geometry.dispose();material.dispose()
  })
  it('allows RB + RS to look and LS to walk without moving the planting preview',()=>{
    store.getState().placePlant('white-oak',0,0);setup();store.getState().startArrangement([store.getState().design.plants[0].id])
    const preview=store.getState().walkArrangement!.preview,position=camera.position.clone(),yaw=camera.rotation.y
    button(5,true);pad.axes[2]=.8;pad.axes[1]=-1;frame(15);button(5,false);pad.axes.fill(0)
    expect(camera.rotation.y).not.toBe(yaw);expect(camera.position.distanceTo(position)).toBeGreaterThan(.5)
    expect(store.getState().walkArrangement!.preview).toBe(preview)
    const stopped=camera.rotation.y;frame(30);expect(camera.rotation.y).toBe(stopped)
  })
  it('repeats held D-pad steps after a delay and applies the whole group only once on RT',()=>{
    store.getState().placePlant('white-oak',0,0);store.getState().placePlant('red-maple',10,0);store.setState({past:[],future:[]})
    setup();const original=store.getState().design
    store.getState().startArrangement(original.plants.map(p=>p.id))
    button(12,true);frame();const first=store.getState().walkArrangement!
    const setback=(g:typeof first)=>Math.min(...g.preview.map(p=>plantingCoordinates(p,g.frame).away))
    frame(30);expect(setback(store.getState().walkArrangement!)).toBeGreaterThan(setback(first))
    button(12,false);frame();button(7,true);frame(30)
    expect(store.getState().walkArrangement).toBeNull();expect(store.getState().past).toHaveLength(1)
    store.getState().undo();expect(store.getState().design).toBe(original)
  })
  it('previews a row through the LB arrangement wheel without planting on its release',()=>{
    for(const x of [-10,0,10])store.getState().placePlant('red-maple',x,0)
    setup();const original=store.getState().design
    original.plants.forEach(p=>store.getState().toggleWalkMark(p.id))
    button(4,true);button(7,true);pad.axes[3]=-1;frame(10)
    expect(store.getState().wheelIndex).toBe(0)
    button(4,false);pad.axes.fill(0);frame(3)
    const group=store.getState().walkArrangement!
    expect(group).toBeTruthy();expect(new Set(group.preview.map(p=>plantingCoordinates(p,group.frame).away.toFixed(6))).size).toBe(1)
    expect(store.getState().design).toBe(original)
    button(7,false);frame();button(7,true);frame();expect(store.getState().walkArrangement).toBeNull()
  })
  it('B cancels a group preview, then clears marks, before it exits Walk',()=>{
    store.getState().placePlant('white-oak',0,0);setup();const original=store.getState().design
    store.getState().startArrangement([original.plants[0].id]);store.getState().moveArrangement(1,0)
    button(1,true);frame();expect(store.getState().walkArrangement).toBeNull();expect(store.getState().viewMode).toBe('walk')
    button(1,false);frame();button(1,true);frame();expect(store.getState().walkMarked).toEqual([]);expect(store.getState().viewMode).toBe('walk')
    button(1,false);frame();button(1,true);frame();expect(store.getState().viewMode).toBe('garden');expect(store.getState().design).toBe(original)
  })
  it('discards group previews on disconnect and does not apply held buttons after reconnect',()=>{
    store.getState().placePlant('white-oak',0,0);setup();const original=store.getState().design
    store.getState().startArrangement([original.plants[0].id]);store.getState().moveArrangement(1,0)
    pads=[];frame();expect(store.getState().walkArrangement).toBeNull();expect(store.getState().walkMarked).toEqual([])
    button(2,true);button(7,true);pads=[pad];frame(10);expect(store.getState().design).toBe(original)
  })
  it('leaves menu and form arrow keys available without walking behind the controls',()=>{
    pads=[]
    const listeners=vi.spyOn(win,'addEventListener')
    setup()
    const handler=listeners.mock.calls.find(([type])=>type==='keydown')![1] as (event:KeyboardEvent)=>void
    class FieldStub {isContentEditable=false;constructor(private blocked:boolean){}closest(){return this.blocked?this:null}}
    vi.stubGlobal('HTMLElement',FieldStub)
    const before=camera.position.clone(),preventDefault=vi.fn()
    handler({key:'ArrowUp',target:new FieldStub(true),preventDefault} as unknown as KeyboardEvent);frame(5)
    expect(camera.position.distanceTo(before)).toBeLessThan(1e-8);expect(preventDefault).not.toHaveBeenCalled()
    handler({key:'ArrowUp',target:new FieldStub(false),preventDefault} as unknown as KeyboardEvent);frame(5)
    expect(camera.position.distanceTo(before)).toBeGreaterThan(.1);expect(preventDefault).toHaveBeenCalled()
  })
  it('excludes the original trunk while measuring an existing tree carried with X',()=>{
    store.getState().placePlant('white-oak',0,0);store.getState().placePlant('red-maple',20,0)
    const design=store.getState().design,id=design.plants[0].id
    setup();camera.position.set(0,5.6,10)
    const geometry=new BoxGeometry(4,10,4),material=new MeshBasicMaterial(),tree=new Mesh(geometry,material)
    tree.position.y=5;tree.userData.plantId=id;scene.add(tree);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true)
    button(2,true);frame();button(2,false);frame(6)
    const carry=store.getState().walkArrangement!.preview[0],measurement=measurePlacement(carry,design.plants,[{xFt:-20,zFt:-20},{xFt:30,zFt:-20},{xFt:30,zFt:30},{xFt:-20,zFt:30}])
    expect(carry.id).toBe(id);expect(carry.zFt).toBe(0)
    expect(measurement.neighbor?.plant.id).toBe(design.plants[1].id)
    expect(measurement.neighbor?.distanceFt).toBe(20)
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
    button(2,true);frame();expect(store.getState().walkArrangement?.preview[0]).toEqual(original.plants[0])
    expect(store.getState().design).toBe(original)
    button(2,false);frame(30)
    expect(store.getState().walkArrangement?.preview[0]).toEqual(original.plants[0])
    pad.axes[2]=.8;frame(10);pad.axes.fill(0);button(2,true);frame()
    expect(store.getState().walkArrangement).toBeNull();expect(store.getState().design.plants[0]).not.toEqual(original.plants[0])
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
