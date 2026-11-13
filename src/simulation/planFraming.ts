import type { YardPoint } from './coordinates'

// Reserve space for the scene menus and collapsed solar console, in CSS pixels.
export function planFraming(points:readonly YardPoint[],width:number,height:number) {
  const xs=points.map(p=>p.xFt),ys=points.map(p=>p.zFt)
  const left=Math.min(...xs),right=Math.max(...xs),bottom=Math.min(...ys),top=Math.max(...ys)
  const safeWidth=Number.isFinite(width)&&width>0?width:320,safeHeight=Number.isFinite(height)&&height>0?height:490
  const zoom=Math.max(.1,Math.min(Math.max(40,safeWidth-48)/Math.max(1,right-left),Math.max(40,safeHeight-180)/Math.max(1,top-bottom)))
  return {xFt:(left+right)/2,zFt:(bottom+top)/2+16/zoom,zoom}
}
