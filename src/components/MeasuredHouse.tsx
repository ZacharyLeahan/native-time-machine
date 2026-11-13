import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three'
import { pickwickProperty } from '../data/pickwickProperty'
import { groundHeight, roofHeight, surface } from '../simulation/surface'

export function MeasuredHouse(){
  const [roof,walls]=useMemo(()=>{
    const roof=new BufferGeometry()
    roof.setAttribute('position',new Float32BufferAttribute(surface.roof.vertices.flatMap(([x,z,y])=>[x,y,-z]),3))
    roof.setIndex(surface.roof.indices);roof.computeVertexNormals()
    const vertices:number[]=[]
    const points=pickwickProperty.buildingFootprint
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length]
      const av=[a.xFt,groundHeight(a.xFt,a.zFt),-a.zFt],bv=[b.xFt,groundHeight(b.xFt,b.zFt),-b.zFt]
      const at=[a.xFt,roofHeight(a.xFt,a.zFt),-a.zFt],bt=[b.xFt,roofHeight(b.xFt,b.zFt),-b.zFt]
      vertices.push(...av,...bv,...at,...bv,...bt,...at)
    }
    const walls=new BufferGeometry();walls.setAttribute('position',new Float32BufferAttribute(vertices,3));walls.computeVertexNormals()
    return [roof,walls]
  },[])
  useEffect(()=>()=>{roof.dispose();walls.dispose()},[roof,walls])
  return <group><mesh geometry={walls} castShadow receiveShadow><meshStandardMaterial color="#d8c9b4" side={DoubleSide} roughness={.9}/></mesh><mesh geometry={roof} castShadow receiveShadow><meshStandardMaterial color="#715548" side={DoubleSide} roughness={.85} flatShading/></mesh></group>
}
