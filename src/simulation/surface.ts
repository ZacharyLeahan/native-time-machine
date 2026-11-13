import surface from '../data/pickwickSurface.json'
export { surface }
export function groundHeight(xFt:number,zFt:number):number {
  const {min,step,size,heights}=surface.grid
  const x=Math.max(0,Math.min(size-1,(xFt-min)/step)),z=Math.max(0,Math.min(size-1,(zFt-min)/step))
  const ix=Math.min(size-2,Math.floor(x)),iz=Math.min(size-2,Math.floor(z)),tx=x-ix,tz=z-iz
  const a=heights[iz*size+ix]*(1-tx)+heights[iz*size+ix+1]*tx
  const b=heights[(iz+1)*size+ix]*(1-tx)+heights[(iz+1)*size+ix+1]*tx
  return a*(1-tz)+b*tz
}
export function roofHeight(x:number,z:number):number {
  let best=Infinity,height=0
  for(const [rx,rz,y] of surface.roof.vertices){const d=(rx-x)**2+(rz-z)**2;if(d<best){best=d;height=y}}
  return height
}
