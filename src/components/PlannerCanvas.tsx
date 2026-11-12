import { Grid, Line, OrbitControls, OrthographicCamera, PerspectiveCamera, Sky, SoftShadows, useTexture } from '@react-three/drei'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, MOUSE, Shape } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Gamepad2, Keyboard, MousePointer2 } from 'lucide-react'
import { catalogById } from '../data/catalog'
import { pickwickProperty, type SitePoint } from '../data/pickwickProperty'
import { siteToWorld, worldToSite } from '../simulation/coordinates'
import { dimensionsForPlantAtYear } from '../simulation/growth'
import { usePlannerStore, type ViewMode } from '../store/usePlannerStore'
import { PlantSymbol } from './PlantSymbol'
import { SunPanel } from './SunPanel'
import { calculateSolarSnapshot, localDateString, sampleSunPath, type SolarSnapshot } from '../simulation/solar'
import { WalkControls } from './WalkControls'

function makeHorizontalShape(points: readonly SitePoint[]) {
  const shape=new Shape()
  points.forEach((point,index)=>index===0?shape.moveTo(point.xFt,point.zFt):shape.lineTo(point.xFt,point.zFt))
  shape.closePath()
  return shape
}

const AERIAL_CORNERS = [
  { xFt:-158.796, zFt:-208.712, u:0, v:0 },
  { xFt:177.149, zFt:-200.270, u:1, v:0 },
  { xFt:167.541, zFt:182.106, u:1, v:1 },
  { xFt:-168.404, zFt:173.664, u:0, v:1 },
] as const

type ImageryLayer = 'detail' | 'current'

function AerialContext({layer}:{layer:ImageryLayer}) {
  const textures=useTexture(['/pickwick-pema-2021.png','/pickwick-naip-2024.png'])
  const texture=layer==='detail'?textures[0]:textures[1]
  const geometry=useMemo(()=>{
    const value=new BufferGeometry()
    value.setAttribute('position',new Float32BufferAttribute(AERIAL_CORNERS.flatMap((point)=>[point.xFt,-.22,-point.zFt]),3))
    value.setAttribute('uv',new Float32BufferAttribute(AERIAL_CORNERS.flatMap((point)=>[point.u,point.v]),2))
    value.setIndex([0,2,1,0,3,2])
    value.computeVertexNormals()
    return value
  },[])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh geometry={geometry} receiveShadow><meshBasicMaterial map={texture} color="#ffffff" side={DoubleSide}/></mesh>
}

function SolarLighting({snapshot,path,viewMode}:{snapshot:SolarSnapshot,path:[number,number,number][],viewMode:ViewMode}) {
  const [east,up,south]=snapshot.worldDirection
  const sunPosition:[number,number,number]=[east*230,up*230,south*230]
  const daylight=Math.max(0,Math.min(1,(snapshot.altitudeDeg+2)/25))
  const background=snapshot.altitudeDeg<-6?'#111a25':snapshot.altitudeDeg<4?'#c78b69':viewMode==='planner'?'#dce4db':'#bfd7df'
  return <>
    <color attach="background" args={[background]}/>
    {viewMode!=='planner'&&<>
      <Sky distance={450000} sunPosition={sunPosition} turbidity={8} rayleigh={2.2}/>
      <SoftShadows size={15} samples={12} focus={.45}/>
      {viewMode==='garden'&&path.length>1&&<Line points={path} color="#f4c957" lineWidth={1.2} transparent opacity={.68}/>}
      {snapshot.isAboveHorizon&&<mesh position={sunPosition}><sphereGeometry args={[4,24,24]}/><meshBasicMaterial color="#fff3a7" toneMapped={false}/></mesh>}
    </>}
    <hemisphereLight args={['#e9f2ee','#59604b',viewMode==='planner'?1.5:.35+.85*daylight]}/>
    <directionalLight
      position={sunPosition}
      intensity={snapshot.isAboveHorizon?(viewMode==='planner'?1.45:3.2)*daylight:0}
      color={snapshot.altitudeDeg<10?'#ffd2a2':'#fff4dd'}
      castShadow
      shadow-mapSize={[4096,4096]}
      shadow-camera-left={-180}
      shadow-camera-right={180}
      shadow-camera-top={180}
      shadow-camera-bottom={-180}
      shadow-camera-near={1}
      shadow-camera-far={520}
      shadow-bias={-.00008}
      shadow-normalBias={.025}
    />
  </>
}

function YardScene({imageryLayer,solarSnapshot,sunPath}:{imageryLayer:ImageryLayer,solarSnapshot:SolarSnapshot,sunPath:[number,number,number][]}) {
  const design = usePlannerStore((s) => s.design)
  const armed = usePlannerStore((s) => s.armedSpeciesId)
  const viewMode = usePlannerStore((s) => s.viewMode)
  const place = usePlannerStore((s) => s.placePlant)
  const move = usePlannerStore((s) => s.movePlant)
  const select = usePlannerStore((s) => s.selectPlant)
  const resetKey = usePlannerStore((s) => s.cameraResetKey)
  const year = usePlannerStore((s) => s.year)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const controls = useRef<OrbitControlsImpl>(null)
  const parcelShape=makeHorizontalShape(pickwickProperty.boundary)
  const houseShape=makeHorizontalShape(pickwickProperty.buildingFootprint)
  const boundaryPoints=[...pickwickProperty.boundary,pickwickProperty.boundary[0]].map((point)=>[point.xFt,.18,-point.zFt] as [number,number,number])
  const houseBoundaryPoints=[...pickwickProperty.buildingFootprint,pickwickProperty.buildingFootprint[0]].map((point)=>[point.xFt,.2,-point.zFt] as [number,number,number])
  const walkObstacles=useMemo(()=>design.plants.flatMap((plant)=>{
    const species=catalogById.get(plant.speciesId)
    if(!species||species.type==='Perennial')return []
    const dimensions=dimensionsForPlantAtYear(species,plant,year)
    const world=siteToWorld(plant)
    const radius=species.type==='Shrub'?Math.max(1.2,dimensions.widthFt*.32):Math.max(1.05,dimensions.widthFt*.05+.75)
    return [{x:world.x,z:world.z,radius}]
  }),[design.plants,year])

  useEffect(() => { controls.current?.reset() }, [resetKey])

  function onYardClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    if(viewMode==='walk')return
    const site=worldToSite(event.point)
    if (armed) place(armed, site.xFt, site.zFt)
    else select(null)
  }
  function onMove(event: ThreeEvent<PointerEvent>) {
    if (!draggingId) return
    event.stopPropagation()
    const site=worldToSite(event.point)
    move(draggingId, site.xFt, site.zFt)
  }

  return <>
    {viewMode==='garden'
      ?<PerspectiveCamera key="garden-camera" makeDefault position={[170,125,190]} fov={44} near={.1} far={700}/>
      :viewMode==='walk'
        ?<PerspectiveCamera key="walk-camera" makeDefault position={[0,5.6,95]} fov={72} near={.05} far={700}/>
        :<OrthographicCamera key="plan-camera" makeDefault position={[0,150,.01]} rotation={[-1.5707,0,0]} zoom={2.3} near={.1} far={400}/>}
    <SolarLighting snapshot={solarSnapshot} path={sunPath} viewMode={viewMode}/>
    {viewMode!=='planner'&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,-.28,0]} receiveShadow><planeGeometry args={[420,420]}/><meshStandardMaterial color="#78886a" roughness={1}/></mesh>}
    <AerialContext layer={imageryLayer}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.03,0]} onClick={onYardClick} onPointerMove={onMove} onPointerUp={()=>setDraggingId(null)} receiveShadow>
      <shapeGeometry args={[parcelShape]} />
      <meshStandardMaterial color={viewMode==='garden'?'#b8d3a6':'#dce8d1'} roughness={1} transparent opacity={viewMode==='garden'?.2:.12} depthWrite={false} />
    </mesh>
    {viewMode==='planner'&&<Grid position={[0,.02,0]} args={[240,240]} cellSize={5} cellThickness={.3} cellColor="#7f8f77" sectionSize={25} sectionThickness={.8} sectionColor="#52634e" fadeDistance={320} infiniteGrid={false}/>} 
    <Line points={boundaryPoints} color="#334e39" lineWidth={viewMode==='garden'?2:1.4}/>
    {viewMode!=='planner'?<group>
      <mesh rotation={[-Math.PI/2,0,0]} castShadow receiveShadow><extrudeGeometry args={[houseShape,{depth:10,bevelEnabled:false}]}/><meshStandardMaterial color="#d8c9b4" roughness={.9}/></mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,10.05,0]} castShadow receiveShadow><extrudeGeometry args={[houseShape,{depth:1.15,bevelEnabled:false}]}/><meshStandardMaterial color="#715548" roughness={.82}/></mesh>
    </group>:<group><mesh rotation={[-Math.PI/2,0,0]} position={[0,.08,0]}><shapeGeometry args={[houseShape]}/><meshStandardMaterial color="#d6ccbd"/></mesh><Line points={houseBoundaryPoints} color="#766b5c" lineWidth={1}/></group>}
    {design.plants.map((plant)=><PlantSymbol key={plant.id} plant={plant} onDragStart={setDraggingId} />)}
    {viewMode==='walk'?<WalkControls obstacles={walkObstacles}/>:<OrbitControls ref={controls} makeDefault target={[0,viewMode==='garden'?15:0,0]} enableRotate={viewMode==='garden'} minZoom={1.8} maxZoom={18} minDistance={35} maxDistance={420} maxPolarAngle={Math.PI*.48} mouseButtons={{LEFT:MOUSE.ROTATE,MIDDLE:MOUSE.DOLLY,RIGHT:MOUSE.PAN}} />}
  </>
}

function WalkHud() {
  const [pointerLocked,setPointerLocked]=useState(false)
  const [controllerConnected,setControllerConnected]=useState(false)
  useEffect(()=>{
    const updatePointer=()=>setPointerLocked(document.pointerLockElement instanceof HTMLCanvasElement)
    const updateController=()=>setControllerConnected(Boolean(navigator.getGamepads?.().find(Boolean)))
    document.addEventListener('pointerlockchange',updatePointer)
    window.addEventListener('gamepadconnected',updateController)
    window.addEventListener('gamepaddisconnected',updateController)
    const poll=window.setInterval(updateController,750)
    updatePointer();updateController()
    return()=>{document.removeEventListener('pointerlockchange',updatePointer);window.removeEventListener('gamepadconnected',updateController);window.removeEventListener('gamepaddisconnected',updateController);window.clearInterval(poll)}
  },[])
  return <div className="walk-hud" aria-live="polite">
    <div className="walk-reticle" aria-hidden="true"><i/><i/></div>
    <div className="walk-help">
      <strong>{pointerLocked?'Mouse captured · explore the yard':'Click the landscape to capture the mouse'}</strong>
      <span><Keyboard size={13}/> WASD / arrows move · Shift sprints · Q exits</span>
      <span><MousePointer2 size={13}/> Mouse looks · Esc releases</span>
      <span className={controllerConnected?'connected':''}><Gamepad2 size={14}/> {controllerConnected?'Xbox controller connected':'Xbox: left stick move · right stick look · L3 sprint · B exits'}</span>
    </div>
  </div>
}

export function PlannerCanvas() {
  const armed = usePlannerStore((s)=>s.armedSpeciesId)
  const viewMode = usePlannerStore((s)=>s.viewMode)
  const [imageryLayer,setImageryLayer]=useState<ImageryLayer>('detail')
  const julyBaseline=useMemo(()=>`${localDateString().slice(0,4)}-07-15`,[])
  const [solarDate,setSolarDate]=useState(julyBaseline)
  const [solarMinute,setSolarMinute]=useState(()=>Math.round(calculateSolarSnapshot(julyBaseline,720).solarNoonMinutes))
  const [solarPlaying,setSolarPlaying]=useState(false)
  const [solarSpeed,setSolarSpeed]=useState(5)
  const solarSnapshot=useMemo(()=>calculateSolarSnapshot(solarDate,solarMinute),[solarDate,solarMinute])
  const sunPath=useMemo(()=>sampleSunPath(solarDate),[solarDate])

  useEffect(()=>{
    if(!solarPlaying)return
    const timer=window.setInterval(()=>setSolarMinute((current)=>{
      const next=current+solarSpeed
      if(next>=1439){setSolarPlaying(false);return 1439}
      return next
    }),100)
    return()=>window.clearInterval(timer)
  },[solarPlaying,solarSpeed])

  function changeDate(date:string) {
    if(!date)return
    setSolarDate(date)
    const day=calculateSolarSnapshot(date,720)
    setSolarMinute(Math.round(day.solarNoonMinutes))
    setSolarPlaying(false)
  }

  function toggleSolarPlayback(playing:boolean) {
    if(playing&&solarMinute>=1439)setSolarMinute(Math.round(solarSnapshot.solarNoonMinutes))
    setSolarPlaying(playing)
  }

  function returnToNow() {
    setSolarDate(julyBaseline)
    setSolarMinute(Math.round(calculateSolarSnapshot(julyBaseline,720).solarNoonMinutes))
    setSolarPlaying(false)
  }

  return <div className={`canvas-wrap ${armed ? 'placing' : ''} ${viewMode==='walk'?'walking':''}`}>
    <Canvas shadows dpr={[1,2]} gl={{antialias:true,powerPreference:'high-performance'}}>
      <YardScene imageryLayer={imageryLayer} solarSnapshot={solarSnapshot} sunPath={sunPath}/>
    </Canvas>
    <div className="view-badge">{viewMode==='garden'?'3D GARDEN':viewMode==='walk'?'WALK MODE':'OVERHEAD PLAN'}</div>
    {viewMode==='planner'&&<div className="north-badge"><strong>N</strong><span>↑</span></div>}
    {viewMode!=='walk'&&<div className="imagery-control" role="group" aria-label="Aerial imagery layer">
      <span>Base imagery</span>
      <button className={imageryLayer==='detail'?'active':''} onClick={()=>setImageryLayer('detail')}><strong>2021 Detail</strong><small>6-inch · leaf-off</small></button>
      <button className={imageryLayer==='current'?'active':''} onClick={()=>setImageryLayer('current')}><strong>2024 Current</strong><small>2-foot · leaf-on</small></button>
    </div>}
    {viewMode!=='walk'&&<><div className="canvas-hint">{armed ? 'Click the lawn to plant' : viewMode==='garden'?'Drag to orbit · Right-drag to pan · Scroll to zoom':'Drag plants to move · Right-drag to pan · Scroll to zoom'}</div>
    <div className="scale-badge">15 Pickwick Ln · 0.485 acre</div>
    <div className="imagery-badge">{imageryLayer==='detail'?'PEMA 2021 high-resolution detail':'NAIP 2024 current context'} · approximate alignment</div>
    <SunPanel date={solarDate} minute={solarMinute} playing={solarPlaying} speed={solarSpeed} snapshot={solarSnapshot} onDateChange={changeDate} onMinuteChange={(minute)=>{setSolarMinute(minute);setSolarPlaying(false)}} onPlayingChange={toggleSolarPlayback} onSpeedChange={setSolarSpeed} onToday={returnToNow}/></>}
    {viewMode==='walk'&&<WalkHud/>}
  </div>
}
