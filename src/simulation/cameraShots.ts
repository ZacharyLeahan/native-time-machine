export type CameraPreset = 'front'|'back'|'left'|'right'|'selected'
export function cameraShot(preset:CameraPreset,focus?:{x:number;y:number;z:number;height:number;width:number},aspect=1) {
  const target:[number,number,number]=preset==='selected'&&focus?[focus.x,focus.y+focus.height/2,focus.z]:[0,20,0]
  const radius=preset==='selected'&&focus?Math.max(6,Math.hypot(focus.height,focus.width)/2):100
  const safeAspect=Number.isFinite(aspect)&&aspect>0?aspect:1
  const halfFov=Math.min(22*Math.PI/180,Math.atan(Math.tan(22*Math.PI/180)*Math.max(.2,safeAspect)))
  const distance=Math.max(40,radius/Math.sin(halfFov)*1.15)
  const direction=preset==='left'?[-1,.45,0]:preset==='right'?[1,.45,0]:preset==='back'?[0,.45,-1]:preset==='selected'?[.7,.45,1]:[0,.45,1]
  const length=Math.hypot(...direction)
  return {target,position:target.map((value,i)=>value+direction[i]/length*distance) as [number,number,number]}
}
