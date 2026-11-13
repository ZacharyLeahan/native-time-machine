import { Html, Line } from '@react-three/drei'
import { useMemo } from 'react'
import { Vector3 } from 'three'
import { catalogById } from '../data/catalog'
import { usePlacementMeasurements } from '../hooks/usePlacementMeasurements'
import { distanceLabel, type MeasurementPoint } from '../simulation/measurements'
import { groundHeight } from '../simulation/surface'
import { usePlannerStore } from '../store/usePlannerStore'
import { layoutMeasurementLabels } from '../simulation/measurementLabels'
import './PlacementMeasurements.css'

// Measurements never participate in plant picking, dragging or controller raycasts.
const noRaycast=()=>{}
function world(point:MeasurementPoint,lift=.45):[number,number,number] {return [point.xFt,groundHeight(point.xFt,point.zFt)+lift,-point.zFt]}
function groundLine(a:MeasurementPoint,b:MeasurementPoint) {
  const steps=Math.max(1,Math.ceil(Math.hypot(b.xFt-a.xFt,b.zFt-a.zFt)/3))
  return Array.from({length:steps+1},(_,i)=>world({xFt:a.xFt+(b.xFt-a.xFt)*i/steps,zFt:a.zFt+(b.zFt-a.zFt)*i/steps}))
}
function Endpoint({point,color}:{point:MeasurementPoint;color:string}) {
  return <mesh position={world(point,.5)} rotation={[-Math.PI/2,0,0]} raycast={noRaycast} renderOrder={30}><ringGeometry args={[.4,.7,20]}/><meshBasicMaterial color={color} transparent opacity={1} depthTest={false} depthWrite={false}/></mesh>
}
type DimensionAnchor={key:'boundary'|'plant';point:MeasurementPoint;label:string}
function DimensionLine({start,end,label,kind,anchors}:{start:MeasurementPoint;end:MeasurementPoint;label:string;kind:'boundary'|'plant';anchors:DimensionAnchor[]}) {
  const mode=usePlannerStore(s=>s.viewMode),grid=usePlannerStore(s=>s.coordinateGrid)
  const color=kind==='boundary'?'#f4d477':'#8ee8ef'
  const points=useMemo(()=>groundLine(start,end),[start,end])
  const separated=Math.hypot(start.xFt-end.xFt,start.zFt-end.zFt)>1e-6
  const midpoint={xFt:(start.xFt+end.xFt)/2,zFt:(start.zFt+end.zFt)/2}
  return <group>
    {separated&&<><Line points={points} color="#14291d" lineWidth={5} transparent opacity={1} depthTest={false} depthWrite={false} raycast={noRaycast} renderOrder={28}/>
    <Line points={points} color={color} lineWidth={2} transparent opacity={1} depthTest={false} depthWrite={false} raycast={noRaycast} renderOrder={29}/></>}
    <Endpoint point={end} color={color}/>
    <Html center position={world(midpoint,1)} zIndexRange={[8,0]} style={{pointerEvents:'none'}} calculatePosition={(object,camera,size)=>{
      const project=(point:Vector3)=>{point.project(camera);return {x:(point.x+1)*size.width/2,y:(1-point.y)*size.height/2}}
      const subject=project(new Vector3(...world(start,1)))
      const labels=anchors.map(anchor=>({...project(anchor.key===kind?object.getWorldPosition(new Vector3()):new Vector3(...world(anchor.point,1))),key:anchor.key,width:anchor.label.length*7+18,height:25}))
      const reserved=mode==='walk'?[{x:0,y:0,width:325,height:225},{x:Math.max(0,size.width/2-240),y:size.height-180,width:480,height:180}]:[{x:0,y:0,width:size.width,height:mode==='planner'&&grid?155:125},{x:Math.max(0,size.width-325),y:size.height-100,width:325,height:100}]
      const subjectBox=mode==='planner'||mode==='walk'?{x:subject.x-24,y:subject.y-24,width:48,height:48}:undefined
      return layoutMeasurementLabels(subject,labels,size,reserved,subjectBox)[kind]
    }}><div className={`distance-label ${kind}`}>{label}</div></Html>
  </group>
}
export function PlacementDistanceLines() {
  const {measurements}=usePlacementMeasurements()
  if(!measurements)return null
  const {subject,boundary,neighbor}=measurements
  const neighborName=neighbor?catalogById.get(neighbor.plant.speciesId)?.commonName??'Plant':''
  const dimensions=[
    ...(boundary?[{kind:'boundary' as const,end:boundary.point,label:`${boundary.outside?'Outside boundary':'Boundary'} ${distanceLabel(boundary.distanceFt)}`}]:[]),
    ...(neighbor?[{kind:'plant' as const,end:neighbor.plant,label:`${neighborName} ${distanceLabel(neighbor.distanceFt)}`}]:[]),
  ]
  const anchors=dimensions.map(dimension=>({key:dimension.kind,label:dimension.label,point:{xFt:(subject.xFt+dimension.end.xFt)/2,zFt:(subject.zFt+dimension.end.zFt)/2}}))
  return <group name="placement-measurements">
    <Endpoint point={subject} color="#ffffff"/>
    {dimensions.map(dimension=><DimensionLine key={dimension.kind} start={subject} end={dimension.end} kind={dimension.kind} label={dimension.label} anchors={anchors}/>)}
  </group>
}
export function PlacementMeasurementReadout({compact=false}:{compact?:boolean}) {
  const {measurements,source,recorded}=usePlacementMeasurements()
  if(!measurements)return null
  const {subject,boundary,neighbor}=measurements
  return <section className={`placement-readout ${compact?'compact':''}`} aria-label="Placement measurements">
    <h3>Placement distances</h3>
    <dl><div><dt>{boundary?.outside?'Outside boundary':'To property boundary'}</dt><dd>{boundary?distanceLabel(boundary.distanceFt):'Unavailable'}</dd></div>
      <div><dt>Nearest plant{neighbor?` · ${catalogById.get(neighbor.plant.speciesId)?.commonName??'Plant'}`:''}</dt><dd>{neighbor?distanceLabel(neighbor.distanceFt):'No other plants'}</dd></div>
      <div><dt>Site X / Y</dt><dd>{subject.xFt.toFixed(1)} / {subject.zFt.toFixed(1)} ft</dd></div></dl>
    <p><span className="boundary-key"/> {source} · approximate alignment</p>
    {!compact&&<p>Horizontal distances from plant centers. Cyan measures center to center, not canopy clearance. {recorded?'Placement limits still use County GIS. ':''}X = east, Y = north; origin is the existing site reference, not a surveyed corner.</p>}
  </section>
}
export function CoordinateGrid() {
  const enabled=usePlannerStore(s=>s.coordinateGrid),mode=usePlannerStore(s=>s.viewMode)
  const lines=useMemo(()=>{
    const result=[]
    for(let value=-125;value<=125;value+=5){
      if(value===0)continue
      for(const axis of ['x','y'] as const){
        const a=axis==='x'?{xFt:value,zFt:-125}:{xFt:-125,zFt:value},b=axis==='x'?{xFt:value,zFt:125}:{xFt:125,zFt:value}
        result.push({key:`${axis}${value}`,points:groundLine(a,b),major:value%25===0})
      }
    }
    return result
  },[])
  if(!enabled||mode!=='planner')return null
  return <group name="coordinate-grid">
    {lines.map(line=><Line key={line.key} points={line.points} color={line.major?'#e8edda':'#52634e'} transparent opacity={line.major?.5:.2} lineWidth={line.major?1:.5} raycast={noRaycast} depthWrite={false}/>)}
    <Line points={groundLine({xFt:-125,zFt:0},{xFt:125,zFt:0})} color="#f4d477" lineWidth={2} depthTest={false} raycast={noRaycast}/>
    <Line points={groundLine({xFt:0,zFt:-125},{xFt:0,zFt:125})} color="#8ee8ef" lineWidth={2} depthTest={false} raycast={noRaycast}/>
    <Endpoint point={{xFt:0,zFt:0}} color="#ffffff"/>
    <Html center position={world({xFt:0,zFt:0},1)} zIndexRange={[7,0]} style={{pointerEvents:'none'}}><span className="grid-label origin">Site origin (0, 0)</span></Html>
    {[-100,-75,-50,-25,25,50,75,100].flatMap(value=>[
      <Html key={`x${value}`} center position={world({xFt:value,zFt:0},1)} zIndexRange={[7,0]} style={{pointerEvents:'none'}}><span className="grid-label">X {value}</span></Html>,
      <Html key={`y${value}`} center position={world({xFt:0,zFt:value},1)} zIndexRange={[7,0]} style={{pointerEvents:'none'}}><span className="grid-label">Y {value}</span></Html>,
    ])}
  </group>
}
