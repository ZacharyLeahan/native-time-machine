export function flightDelta(forward:number,right:number,up:number,yaw:number,pitch:number,distance:number){
  const magnitude=Math.max(1,Math.hypot(forward,right,up))
  forward/=magnitude;right/=magnitude;up/=magnitude
  const result={x:(-Math.sin(yaw)*Math.cos(pitch)*forward+Math.cos(yaw)*right)*distance,
    y:(Math.sin(pitch)*forward+up)*distance,
    z:(-Math.cos(yaw)*Math.cos(pitch)*forward-Math.sin(yaw)*right)*distance}
  const length=Math.hypot(result.x,result.y,result.z),scale=length>distance&&length>0?distance/length:1
  return {x:result.x*scale,y:result.y*scale,z:result.z*scale}
}
