import { pickwickProperty, type SitePoint } from '../data/pickwickProperty'

export interface WalkObstacle { x: number; z: number; radius: number; id?:string }

export function lookStick(value:number,deadzone=.25):number {
  const input=applyStickDeadzone(Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0,deadzone)
  return Math.sign(input)*Math.abs(input)**1.35
}

export function jumpStep(height:number,velocity:number,delta:number,jump:boolean){
  if(jump&&height<=0)velocity=9
  velocity-=24*delta
  const next=height+velocity*delta
  return next<=0?{height:0,velocity:0}:{height:next,velocity}
}

export function applyStickDeadzone(value:number,deadzone=.14):number {
  const magnitude=Math.abs(value)
  if(magnitude<=deadzone)return 0
  return Math.sign(value)*(magnitude-deadzone)/(1-deadzone)
}

export function walkDelta(forward:number,right:number,yaw:number,distance:number):{x:number;z:number} {
  const magnitude=Math.hypot(forward,right)
  if(magnitude>1){forward/=magnitude;right/=magnitude}
  return {
    x:(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*distance,
    z:(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*distance,
  }
}

export function isPointInsidePolygon(point:SitePoint,polygon:readonly SitePoint[]):boolean {
  let inside=false
  for(let index=0,previous=polygon.length-1;index<polygon.length;previous=index++){
    const a=polygon[index],b=polygon[previous]
    const crosses=(a.zFt>point.zFt)!==(b.zFt>point.zFt)
    if(crosses&&point.xFt<(b.xFt-a.xFt)*(point.zFt-a.zFt)/(b.zFt-a.zFt)+a.xFt)inside=!inside
  }
  return inside
}

function distanceToSegment(point:SitePoint,a:SitePoint,b:SitePoint):number {
  const dx=b.xFt-a.xFt,dz=b.zFt-a.zFt
  const lengthSquared=dx*dx+dz*dz
  const amount=lengthSquared===0?0:Math.max(0,Math.min(1,((point.xFt-a.xFt)*dx+(point.zFt-a.zFt)*dz)/lengthSquared))
  return Math.hypot(point.xFt-(a.xFt+amount*dx),point.zFt-(a.zFt+amount*dz))
}

function distanceToPolygon(point:SitePoint,polygon:readonly SitePoint[]):number {
  let distance=Infinity
  for(let index=0;index<polygon.length;index++)distance=Math.min(distance,distanceToSegment(point,polygon[index],polygon[(index+1)%polygon.length]))
  return distance
}

export function isWalkPositionAllowed(worldX:number,worldZ:number,obstacles:readonly WalkObstacle[]=[]):boolean {
  const site={xFt:worldX,zFt:-worldZ}
  if(!isPointInsidePolygon(site,pickwickProperty.boundary)||distanceToPolygon(site,pickwickProperty.boundary)<1.5)return false
  if(isPointInsidePolygon(site,pickwickProperty.buildingFootprint)||distanceToPolygon(site,pickwickProperty.buildingFootprint)<2.25)return false
  return obstacles.every((obstacle)=>Math.hypot(worldX-obstacle.x,worldZ-obstacle.z)>obstacle.radius)
}
