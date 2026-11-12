import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import { catalogById } from '../data/catalog'
import { dimensionsForPlantAtYear } from '../simulation/growth'
import { siteToWorld } from '../simulation/coordinates'
import { usePlannerStore } from '../store/usePlannerStore'
import type { PlantInstance, PlantSpecies } from '../types'

interface Props { plant: PlantInstance; onDragStart: (id: string) => void }

function TreeModel({ species, height, width, color, winter }: {species:PlantSpecies;height:number;width:number;color:string;winter:boolean}) {
  const understory=species.type==='Understory tree'
  const evergreen=species.id==='existing-evergreen'
  const trunkHeight=height*(understory?.42:.46)
  const crownHeight=Math.max(height-trunkHeight,.8)
  const trunkRadius=Math.max(.16,Math.min(width*.045,1.4))
  if(evergreen){
    const clearTrunk=Math.max(2,height*.12)
    const foliageHeight=height-clearTrunk*.55
    return <group>
      <mesh position={[0,clearTrunk/2,0]} castShadow receiveShadow><cylinderGeometry args={[trunkRadius*.72,trunkRadius,clearTrunk,10]}/><meshStandardMaterial color="#5f4937" roughness={1}/></mesh>
      {[0,.23,.46].map((level)=><mesh key={level} position={[0,clearTrunk+foliageHeight*(.34+level*.62),0]} scale={[1-level*.34,1,1-level*.34]} castShadow receiveShadow>
        <coneGeometry args={[width*.52,foliageHeight*.58,16,5]}/><meshStandardMaterial color={color} roughness={.94}/>
      </mesh>)}
    </group>
  }
  return <group>
    <mesh position={[0,trunkHeight/2,0]} castShadow receiveShadow><cylinderGeometry args={[trunkRadius*.78,trunkRadius,trunkHeight,10]}/><meshStandardMaterial color="#69513c" roughness={1}/></mesh>
    {winter&&<group position={[0,trunkHeight*.76,0]}>
      {[-.7,.7].map((direction)=><mesh key={direction} position={[direction*width*.1,height*.1,0]} rotation={[0,0,direction*-.62]} castShadow><cylinderGeometry args={[trunkRadius*.25,trunkRadius*.44,height*.32,7]}/><meshStandardMaterial color="#6f5b48"/></mesh>)}
      {[-.7,.7].map((direction)=><mesh key={`z${direction}`} position={[0,height*.08,direction*width*.09]} rotation={[direction*.58,0,0]} castShadow><cylinderGeometry args={[trunkRadius*.2,trunkRadius*.4,height*.27,7]}/><meshStandardMaterial color="#76614c"/></mesh>)}
    </group>}
    <group position={[0,trunkHeight+crownHeight*.43,0]}>
      {[[0,0,0,1],[-.22,.02,.05,.72],[.2,.06,-.08,.78],[0,.18,.16,.68]].map(([x,y,z,s],index)=><mesh key={index} position={[x*width,y*crownHeight,z*width]} scale={[width*.5*s,crownHeight*.5*s,width*.5*s]} castShadow receiveShadow>
        <sphereGeometry args={[1,understory?14:18,understory?10:13]}/><meshStandardMaterial color={color} roughness={.88} transparent={winter} opacity={winter?.12:.96} wireframe={winter}/>
      </mesh>)}
    </group>
  </group>
}

function ShrubModel({height,width,color,winter}:{height:number;width:number;color:string;winter:boolean}) {
  return <group>{[-.28,0,.28].map((x,index)=><mesh key={x} position={[x*width,height*.43,index===1?.1*width:0]} scale={[width*.32,height*.48,width*.34]} castShadow receiveShadow><sphereGeometry args={[1,14,10]}/><meshStandardMaterial color={color} roughness={1} transparent={winter} opacity={winter?.32:.95} wireframe={winter}/></mesh>)}</group>
}

function PerennialModel({height,width,color,winter}:{height:number;width:number;color:string;winter:boolean}) {
  return <group>{[-.32,-.12,.12,.32].map((x,index)=><group key={x} position={[x*width,0,((index%2)-.5)*width*.25]}><mesh position={[0,height*.45,0]} castShadow><cylinderGeometry args={[.035,.055,height*.9,5]}/><meshStandardMaterial color={winter?'#8f7a5f':'#4f7747'}/></mesh><mesh position={[0,height*.88,0]} scale={[width*.18,height*.16,width*.18]} castShadow><sphereGeometry args={[1,10,7]}/><meshStandardMaterial color={color} roughness={1}/></mesh></group>)}</group>
}

export function PlantSymbol({ plant, onDragStart }: Props) {
  const year=usePlannerStore((s)=>s.year),season=usePlannerStore((s)=>s.season),viewMode=usePlannerStore((s)=>s.viewMode)
  const selected=usePlannerStore((s)=>s.selectedPlantId===plant.id),select=usePlannerStore((s)=>s.selectPlant)
  const species=catalogById.get(plant.speciesId)
  const dimensions=useMemo(()=>species?dimensionsForPlantAtYear(species,plant,year):null,[species,plant,year])
  if(!species||!dimensions)return null
  const world=siteToWorld(plant)
  const radius=Math.max(dimensions.widthFt/2,.7),isPerennial=species.type==='Perennial',isShrub=species.type==='Shrub',color=species.palette[season],winter=season==='winter'
  function pointerDown(event:ThreeEvent<PointerEvent>){event.stopPropagation();select(plant.id);if(viewMode==='planner')onDragStart(plant.id)}
  return <group position={[world.x,0,world.z]} onPointerDown={pointerDown}>
    {viewMode==='planner'?<>
      <mesh position={[0,.14,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[radius,isPerennial?20:40]}/><meshStandardMaterial color={color} transparent opacity={winter?.38:.78} depthWrite={false}/></mesh>
      <mesh position={[0,.19,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[Math.max(radius-.18,.2),radius,40]}/><meshBasicMaterial color={selected?'#fff9dc':color} transparent opacity={selected?1:.65}/></mesh>
      {!isPerennial&&<mesh position={[0,.3,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[Math.max(.3,isShrub?.45:.58),18]}/><meshBasicMaterial color={winter?'#6d594a':'#244c35'}/></mesh>}
    </>:<>
      {isPerennial?<PerennialModel height={dimensions.heightFt} width={dimensions.widthFt} color={color} winter={winter}/>:isShrub?<ShrubModel height={dimensions.heightFt} width={dimensions.widthFt} color={color} winter={winter}/>:<TreeModel species={species} height={dimensions.heightFt} width={dimensions.widthFt} color={color} winter={winter}/>} 
      <mesh position={[0,.05,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[Math.max(radius-.14,.2),radius,48]}/><meshBasicMaterial color={selected?'#f8da65':plant.origin?.startsWith('existing-')?'#d2b450':'#365e42'} transparent opacity={selected ? .95 : plant.origin?.startsWith('existing-') ? .42 : .22}/></mesh>
    </>}
    {selected&&<Html center position={[0,viewMode==='garden'?dimensions.heightFt+2:.7,0]} style={{pointerEvents:'none'}}><div className="plant-label"><strong>{species.commonName}</strong><span>{dimensions.widthFt.toFixed(0)} ft canopy · {dimensions.heightFt.toFixed(0)} ft tall</span></div></Html>}
  </group>
}
