import { Line, OrbitControls, OrthographicCamera, PerspectiveCamera, Sky, useTexture } from '@react-three/drei'
import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, LinearFilter, LinearMipmapLinearFilter, MOUSE, Shape, SRGBColorSpace } from 'three'
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
import { SpectatorControls } from './SpectatorControls'
import { MeasuredHouse } from './MeasuredHouse'
import { groundHeight } from '../simulation/surface'
import { lot49Plan, recordedLot49Boundary } from '../data/recordedLot49'
import { EquipmentWheel } from './EquipmentWheel'
import { CameraShortcuts, CameraShortcutsRig } from './CameraShortcuts'
import { CoordinateGrid, PlacementDistanceLines, PlacementMeasurementReadout } from './PlacementMeasurements'

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

type ImageryLayer = 'detail' | 'current' | 'solar'

function AerialContext({layer,onClick,onPointerMove}:{layer:ImageryLayer,onClick:(event:ThreeEvent<MouseEvent>)=>void,onPointerMove:(event:ThreeEvent<PointerEvent>)=>void}) {
  const textures=useTexture(['/pickwick-pema-2021-4096.png','/pickwick-naip-2024.png'])
  const gl=useThree((state)=>state.gl)
  const texture=layer==='detail'?textures[0]:textures[1]
  const geometry=useMemo(()=>{
    const value=new BufferGeometry()
    const positions:number[]=[],uvs:number[]=[],indices:number[]=[],segments=100
    const [a,b,,d]=AERIAL_CORNERS
    for(let row=0;row<=segments;row++)for(let col=0;col<=segments;col++){
      const u=col/segments,v=row/segments
      const x=a.xFt+(b.xFt-a.xFt)*u+(d.xFt-a.xFt)*v,z=a.zFt+(b.zFt-a.zFt)*u+(d.zFt-a.zFt)*v
      positions.push(x,groundHeight(x,z),-z);uvs.push(u,v)
      if(row<segments&&col<segments){const i=row*(segments+1)+col;indices.push(i,i+1,i+segments+1,i+1,i+segments+2,i+segments+1)}
    }
    value.setAttribute('position',new Float32BufferAttribute(positions,3))
    value.setAttribute('uv',new Float32BufferAttribute(uvs,2))
    value.setIndex(indices)
    value.computeVertexNormals()
    return value
  },[])
  useEffect(()=>{
    const anisotropy=gl.capabilities.getMaxAnisotropy()
    textures.forEach((aerialTexture)=>{
      aerialTexture.colorSpace=SRGBColorSpace
      aerialTexture.anisotropy=anisotropy
      aerialTexture.minFilter=LinearMipmapLinearFilter
      aerialTexture.magFilter=LinearFilter
      aerialTexture.generateMipmaps=true
      aerialTexture.needsUpdate=true
    })
  },[gl,textures])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <group onClick={onClick} onPointerMove={onPointerMove}>
    <mesh geometry={geometry} receiveShadow>{layer==='solar'?<meshStandardMaterial color="#b4bf9d" roughness={1} side={DoubleSide}/>:<meshBasicMaterial map={texture} color="#ffffff" side={DoubleSide} toneMapped={false}/>}</mesh>
    {layer!=='solar'&&<mesh geometry={geometry} position={[0,.025,0]} receiveShadow><shadowMaterial transparent opacity={.75} depthWrite={false}/></mesh>}
  </group>
}

function SolarLighting({snapshot,path,viewMode}:{snapshot:SolarSnapshot,path:[number,number,number][],viewMode:ViewMode}) {
  const [east,up,south]=snapshot.worldDirection
  const sunPosition:[number,number,number]=[east*230,up*230,south*230]
  const daylight=Math.max(0,Math.min(1,(snapshot.altitudeDeg+2)/25))
  const background=snapshot.altitudeDeg<-6?'#111a25':snapshot.altitudeDeg<4?'#c78b69':viewMode==='planner'?'#dce4db':'#bfd7df'
  return <>
    <color attach="background" args={[background]}/>
    {viewMode!=='planner'&&<>
      {snapshot.altitudeDeg>-6&&<Sky distance={450000} sunPosition={sunPosition} turbidity={8} rayleigh={2.2}/>}
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
      shadow-bias={-.0004}
      shadow-normalBias={.12}
    />
  </>
}

function YardScene({imageryLayer,solarSnapshot,sunPath,recordedBoundary}:{imageryLayer:ImageryLayer,solarSnapshot:SolarSnapshot,sunPath:[number,number,number][],recordedBoundary:boolean}) {
  const design = usePlannerStore((s) => s.design)
  const armed = usePlannerStore((s) => s.armedSpeciesId)
  const viewMode = usePlannerStore((s) => s.viewMode)
  const place = usePlannerStore((s) => s.placePlant)
  const move = usePlannerStore((s) => s.movePlant)
  const select = usePlannerStore((s) => s.selectPlant)
  const resetKey = usePlannerStore((s) => s.cameraResetKey)
  const year = usePlannerStore((s) => s.year)
  const carry=usePlannerStore(s=>s.walkCarry)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const controls = useRef<OrbitControlsImpl>(null)
  const {gl,camera,raycaster,pointer}=useThree()
  const houseShape=makeHorizontalShape(pickwickProperty.buildingFootprint)
  const displayedBoundary=recordedBoundary?recordedLot49Boundary:pickwickProperty.boundary
  const boundaryPoints=displayedBoundary.flatMap((a,i)=>{
    const b=displayedBoundary[(i+1)%displayedBoundary.length],n=Math.ceil(Math.hypot(b.xFt-a.xFt,b.zFt-a.zFt)/2)
    return Array.from({length:n},(_,j)=>{const x=a.xFt+(b.xFt-a.xFt)*j/n,z=a.zFt+(b.zFt-a.zFt)*j/n;return [x,groundHeight(x,z)+.12,-z] as [number,number,number]})
  })
  boundaryPoints.push(boundaryPoints[0])
  const houseBoundaryPoints=[...pickwickProperty.buildingFootprint,pickwickProperty.buildingFootprint[0]].map((point)=>[point.xFt,.2,-point.zFt] as [number,number,number])
  const walkObstacles=useMemo(()=>design.plants.flatMap((plant)=>{
    const species=catalogById.get(plant.speciesId)
    if(!species||species.type==='Perennial')return []
    const dimensions=dimensionsForPlantAtYear(species,plant,year)
    const world=siteToWorld(plant)
    const radius=species.type==='Shrub'?Math.max(1.2,dimensions.widthFt*.32):Math.max(1.05,dimensions.widthFt*.05+.75)
    return [{id:plant.id,x:world.x,z:world.z,radius}]
  }),[design.plants,year])

  useEffect(() => { controls.current?.reset() }, [resetKey])
  useEffect(()=>{
    if(!draggingId)return
    const canvas=gl.domElement,orbit=controls.current
    const finish=()=>{setDraggingId(null);usePlannerStore.getState().endMove()}
    window.addEventListener('pointerup',finish)
    window.addEventListener('pointercancel',finish)
    window.addEventListener('blur',finish)
    return()=>{window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish);window.removeEventListener('blur',finish);usePlannerStore.getState().endMove();if(orbit)orbit.enabled=true;canvas.style.cursor=''}
  },[draggingId,gl])

  function onYardClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    if(viewMode==='walk'||viewMode==='spectator')return
    const site=worldToSite(event.point)
    if (armed) place(armed, site.xFt, site.zFt)
    else select(null)
  }
  function onMove(event: ThreeEvent<PointerEvent>) {
    if (!draggingId) return
    event.stopPropagation()
    raycaster.setFromCamera(pointer,camera)
    const direction=raycaster.ray.direction,origin=raycaster.ray.origin
    if(Math.abs(direction.y)<.00001)return
    let distance=-origin.y/direction.y
    for(let i=0;i<6;i++){const x=origin.x+direction.x*distance,z=-(origin.z+direction.z*distance);distance=(groundHeight(x,z)-origin.y)/direction.y}
    if(distance<0)return
    move(draggingId,origin.x+direction.x*distance,-(origin.z+direction.z*distance))
  }

  return <>
    {viewMode==='garden'
      ?<PerspectiveCamera key="garden-camera" makeDefault position={[170,125,190]} fov={44} near={.1} far={700}/>
      :viewMode==='walk'
        ?<PerspectiveCamera key="walk-camera" makeDefault position={[0,5.6,95]} fov={72} near={.05} far={700}/>
        :viewMode==='spectator'?<PerspectiveCamera key="spectator-camera" makeDefault position={[170,125,190]} fov={72} near={.05} far={5000}/>:<OrthographicCamera key="plan-camera" makeDefault position={[0,150,.01]} rotation={[-1.5707,0,0]} zoom={2.3} near={.1} far={400}/>}
    <SolarLighting snapshot={solarSnapshot} path={sunPath} viewMode={viewMode}/>
    <AerialContext layer={imageryLayer} onClick={onYardClick} onPointerMove={onMove}/>
    <CoordinateGrid/>
    <Line points={boundaryPoints} color="#334e39" lineWidth={viewMode==='garden'?2:1.4}/>
    {viewMode!=='planner'?<MeasuredHouse/>:<group><mesh rotation={[-Math.PI/2,0,0]} position={[0,4,0]}><shapeGeometry args={[houseShape]}/><meshStandardMaterial color="#d6ccbd" transparent opacity={.42} depthWrite={false}/></mesh><Line points={houseBoundaryPoints.map(([x,,z])=>[x,4.1,z])} color="#665b4d" lineWidth={1.4}/></group>}
    {design.plants.map((plant)=><PlantSymbol key={plant.id} plant={carry?.id===plant.id?{...plant,xFt:carry.xFt,zFt:carry.zFt}:plant} onDragMove={onMove} onDragStart={(id)=>{setDraggingId(id);if(controls.current)controls.current.enabled=false}} />)}
    {carry?.speciesId&&<PlantSymbol plant={{id:carry.id,speciesId:carry.speciesId,xFt:carry.xFt,zFt:carry.zFt,plantedYear:0}} onDragMove={()=>{}} onDragStart={()=>{}}/>}
    <PlacementDistanceLines/>
    {viewMode==='spectator'?<SpectatorControls/>:viewMode==='walk'?<WalkControls obstacles={walkObstacles}/>:<OrbitControls ref={controls} makeDefault target={[0,viewMode==='garden'?15:0,0]} enableRotate={viewMode==='garden'} minZoom={1.8} maxZoom={18} minDistance={35} maxDistance={420} maxPolarAngle={Math.PI*.48} mouseButtons={{LEFT:MOUSE.ROTATE,MIDDLE:MOUSE.DOLLY,RIGHT:MOUSE.PAN}} />}
    {viewMode==='garden'&&<CameraShortcutsRig/>}
  </>
}

function WalkHud() {
  const prompt=usePlannerStore(s=>s.walkPrompt),deadzone=usePlannerStore(s=>s.lookDeadzone),setDeadzone=usePlannerStore(s=>s.setLookDeadzone)
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
      <span className={controllerConnected?'connected':''}><Gamepad2 size={14}/> LS move · RS look · L3 sprint · B cancel/exit</span>
      <span>A jump · LT zoom · X pick up/drop · RT drop</span><span>{prompt}</span>
      <button className="wheel-open" style={{pointerEvents:'auto'}} onClick={()=>usePlannerStore.setState({wheelOpen:true,wheelIndex:null})}>LB · Plant equipment wheel</button>
      <label style={{pointerEvents:'auto',fontSize:10,gridColumn:'1 / -1'}}>Aim deadzone {Math.round(deadzone*100)}% <input aria-label="Controller aim deadzone" type="range" min=".1" max=".4" step=".01" value={deadzone} onChange={e=>setDeadzone(Number(e.target.value))}/></label>
    </div>
  </div>
}

export function PlannerCanvas() {
  const recordedBoundary=usePlannerStore(s=>s.recordedBoundary),toggleBoundary=usePlannerStore(s=>s.toggleBoundary)
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

  return <div className={`canvas-wrap ${armed ? 'placing' : ''} ${(viewMode==='walk'||viewMode==='spectator')?'walking':''}`}>
    <Canvas shadows dpr={[1,2]} gl={{antialias:true,powerPreference:'high-performance'}}>
      <YardScene imageryLayer={imageryLayer} solarSnapshot={solarSnapshot} sunPath={sunPath} recordedBoundary={recordedBoundary}/>
    </Canvas>
    <div className="view-badge">{viewMode==='garden'?'3D GARDEN':viewMode==='walk'?'WALK MODE':viewMode==='spectator'?'SPECTATOR · READ ONLY':'OVERHEAD PLAN'}</div>
    {(viewMode==='garden'||viewMode==='planner')&&<CameraShortcuts/>}
    {viewMode==='planner'&&<div className="north-badge"><strong>N</strong><span>↑</span></div>}
    {viewMode!=='walk'&&viewMode!=='spectator'&&<div className="imagery-control" role="group" aria-label="Aerial imagery layer">
      <span>Base imagery</span>
      <button className={imageryLayer==='detail'?'active':''} onClick={()=>setImageryLayer('detail')}><strong>2021 Detail</strong><small>6-inch · leaf-off</small></button>
      <button className={imageryLayer==='current'?'active':''} onClick={()=>setImageryLayer('current')}><strong>2024 Current</strong><small>2-foot · leaf-on</small></button>
      <button className={imageryLayer==='solar'?'active':''} aria-pressed={imageryLayer==='solar'} onClick={()=>setImageryLayer('solar')}><strong>Solar ground</strong><small>Simulated shadows</small></button>
    </div>}
    {viewMode!=='walk'&&viewMode!=='spectator'&&<><div className="canvas-hint">{armed ? 'Click the lawn to plant' : viewMode==='garden'?'Drag to orbit · Right-drag to pan · Scroll to zoom':'Drag plants to move · Right-drag to pan · Scroll to zoom'}</div>
    <button className="scale-badge" style={{pointerEvents:'auto'}} aria-label="Toggle recorded plan and county GIS boundary" aria-pressed={recordedBoundary} title={`${lot49Plan.anchor} Click to compare county GIS. Placement limits use county GIS.`} onClick={toggleBoundary}>{recordedBoundary?'Lot 49 · recorded dimensions · GIS anchor':'County GIS boundary · click to compare'}</button>
    <div className="imagery-badge">{imageryLayer==='solar'?'LiDAR terrain + fitted roof':`${imageryLayer==='detail'?'PEMA 2021':'NAIP 2024'} · photo shadows are fixed`}</div>
    <SunPanel date={solarDate} minute={solarMinute} playing={solarPlaying} speed={solarSpeed} snapshot={solarSnapshot} onDateChange={changeDate} onMinuteChange={(minute)=>{setSolarMinute(minute);setSolarPlaying(false)}} onPlayingChange={toggleSolarPlayback} onSpeedChange={setSolarSpeed} onToday={returnToNow}/></>}
    {viewMode==='walk'&&<><WalkHud/><EquipmentWheel/><PlacementMeasurementReadout compact/></>}
    {viewMode==='spectator'&&<div className="walk-hud"><div className="walk-reticle" aria-hidden="true"><i/><i/></div><div className="walk-help"><strong>Spectator · free flight · editing disabled</strong><span>WASD / arrows fly · mouse looks</span><span>Space / E up · Q / C down · Shift fast</span><span>Xbox: LS fly · RS look · RB up · LB down</span><span>L3 fast · LT zoom · B / F exit</span><span>Click to capture mouse · Esc releases</span></div></div>}
  </div>
}
