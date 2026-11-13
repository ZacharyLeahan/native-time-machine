export interface GrabPose {xFt:number;zFt:number;heightFt:number;yaw:number;pitch:number}
export interface GrabPoint {xFt:number;zFt:number;heightFt:number}
export interface GrabOffset {x:number;y:number;z:number}
// Camera-local offset preserves the object's initial position: grabbing never
// teleports it to a fixed point in front of the camera. World Z points south.
export function captureGrab(point:GrabPoint,pose:GrabPose):GrabOffset {
  const x=point.xFt-pose.xFt,y=point.heightFt-pose.heightFt,z=pose.zFt-point.zFt
  const c=Math.cos(pose.yaw),s=Math.sin(pose.yaw),localX=c*x-s*z,rotatedZ=s*x+c*z
  return {x:localX,y:Math.cos(pose.pitch)*y+Math.sin(pose.pitch)*rotatedZ,z:-Math.sin(pose.pitch)*y+Math.cos(pose.pitch)*rotatedZ}
}
export function grabbedPoint(offset:GrabOffset,pose:GrabPose):GrabPoint {
  const c=Math.cos(pose.pitch),s=Math.sin(pose.pitch),y=c*offset.y-s*offset.z,z=s*offset.y+c*offset.z
  return {xFt:pose.xFt+Math.cos(pose.yaw)*offset.x+Math.sin(pose.yaw)*z,zFt:pose.zFt+Math.sin(pose.yaw)*offset.x-Math.cos(pose.yaw)*z,heightFt:pose.heightFt+y}
}
