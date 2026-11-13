export interface ScreenBox {x:number;y:number;width:number;height:number}
export interface LabelAnchor {key:string;x:number;y:number;width:number;height:number}
export function boxesOverlap(a:ScreenBox,b:ScreenBox,gap=6) {
  return a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y
}
// Prefer nearby placements, then move to either side of the selected-plant label.
// Screen layout never changes the world endpoints or the reported distance.
export function layoutMeasurementLabels(subject:{x:number;y:number},anchors:LabelAnchor[],viewport:{width:number;height:number},reserved:ScreenBox[]=[],subjectBox:ScreenBox={x:subject.x-85,y:subject.y-48,width:170,height:64}) {
  const occupied:ScreenBox[]=[subjectBox,...reserved]
  const result:Record<string,[number,number]>={}
  for(const anchor of anchors){
    const side=anchor.x>=subject.x?1:-1
    const dx=anchor.x-subject.x,dy=anchor.y-subject.y,length=Math.hypot(dx,dy)
    const nx=length?-dy/length:1,ny=length?dx/length:0
    const offset=Math.abs(nx)*anchor.width/2+Math.abs(ny)*anchor.height/2+12
    const candidates:[number,number][]=[
      [anchor.x+nx*offset,anchor.y+ny*offset],[anchor.x-nx*offset,anchor.y-ny*offset],
      [anchor.x+nx*offset*2,anchor.y+ny*offset*2],[anchor.x-nx*offset*2,anchor.y-ny*offset*2],
      [subject.x+side*(93+anchor.width/2),anchor.y],[subject.x-side*(93+anchor.width/2),anchor.y],
      [anchor.x,subject.y+40+anchor.height/2],[anchor.x,subject.y-70-anchor.height/2],
    ]
    for(let y=20;y<viewport.height-12;y+=36)candidates.push([anchor.x,y])
    let chosen:[number,number]|null=null
    for(const candidate of candidates){
      const x=Math.max(anchor.width/2+8,Math.min(viewport.width-anchor.width/2-8,candidate[0]))
      const y=Math.max(anchor.height/2+8,Math.min(viewport.height-anchor.height/2-8,candidate[1]))
      const box={x:x-anchor.width/2,y:y-anchor.height/2,width:anchor.width,height:anchor.height}
      if(!chosen)chosen=[x,y]
      if(occupied.some(other=>boxesOverlap(box,other)))continue
      chosen=[x,y];break
    }
    result[anchor.key]=chosen??[anchor.x,anchor.y]
    const [x,y]=result[anchor.key]
    occupied.push({x:x-anchor.width/2,y:y-anchor.height/2,width:anchor.width,height:anchor.height})
  }
  return result
}
