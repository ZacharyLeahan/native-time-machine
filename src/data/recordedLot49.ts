import type { SitePoint } from './pickwickProperty'
export const lot49Plan={
  title:'Stonehenge II · Lot 49',book:11,page:30,document:'7565114',recorded:'1961-01-18',
  url:'https://chestercountypa-web.tylerhost.net/web/document/DOCC7565114?search=DOCSEARCH2050S2',
  deed:{book:10531,page:1156,document:'11830173',recorded:'2021-05-05',exhibitPage:5,url:'https://chestercountypa-web.tylerhost.net/web/document/DOC1793S10955?search=DOCSEARCH2050S2'},
  rearFt:130,straightFrontageFt:105,westSideFt:150,eastSideFt:175,cornerRadiusFt:25,cornerAngleDeg:90,
  frontageBearingDeg:69+40/60,sideBearingWestDeg:20+20/60,roadRightOfWayWidthFt:50,
  anchor:'Dimensions checked against 2021 deed Exhibit A. Position and orientation fitted to county GIS rear edge; historical bearing datum and absolute position unverified.',
} as const
export function reconstructLot49():SitePoint[]{
  // The deed's historical bearings have no established tie to modern grid
  // north. Preserve its shape, fitting only the GIS rear midpoint/direction.
  const dx=18.763-(-93.853),dz=87.547-22.328,length=Math.hypot(dx,dz)
  const u={x:dx/length,z:dz/length},v={x:u.z,z:-u.x}
  const rearMid={x:(-93.853+18.763)/2,z:(22.328+87.547)/2}
  const nw={x:rearMid.x-u.x*lot49Plan.rearFt/2,z:rearMid.z-u.z*lot49Plan.rearFt/2}
  const at=(east:number,south:number):SitePoint=>({xFt:nw.x+u.x*east+v.x*south,zFt:nw.z+u.z*east+v.z*south})
  const {rearFt,eastSideFt,westSideFt,cornerRadiusFt:r}=lot49Plan
  const result=[at(rearFt,eastSideFt)]
  for(let i=0;i<=90;i++){const t=i*Math.PI/180;result.push(at(r-r*Math.sin(t),westSideFt+r*Math.cos(t)))}
  result.push(at(0,0),at(rearFt,0));return result
}
export const recordedLot49Boundary=reconstructLot49()
