export interface SitePoint { xFt: number; zFt: number }

export const pickwickProperty = {
  id: '15-pickwick-ln-malvern-pa',
  label: '15 Pickwick Ln · Malvern, PA',
  source: 'Chester County GIS parcel UPI 54-2C-45',
  recordedAreaSqFt: 21125,
  recordedAcres: 0.484963,
  mappedAreaSqFt: 22665.7,
  centerStatePlaneFt: { easting: 2589774.5, northing: 261100.4375 },
  boundary: [
    {xFt:106.407,zFt:-63.690},{xFt:76.927,zFt:-80.707},{xFt:18.943,zFt:-114.565},
    {xFt:13.460,zFt:-117.066},{xFt:7.587,zFt:-118.420},{xFt:1.563,zFt:-118.573},
    {xFt:-4.371,zFt:-117.520},{xFt:-9.975,zFt:-115.301},{xFt:-15.022,zFt:-112.007},
    {xFt:-19.308,zFt:-107.770},{xFt:-22.662,zFt:-102.763},{xFt:-26.219,zFt:-96.085},
    {xFt:-93.853,zFt:22.328},{xFt:18.763,zFt:87.547},
  ] satisfies SitePoint[],
  buildingFootprint: [
    {xFt:37.949,zFt:-31.960},{xFt:19.089,zFt:-43.276},{xFt:21.831,zFt:-47.847},
    {xFt:-1.389,zFt:-61.779},{xFt:-3.534,zFt:-58.204},{xFt:-9.508,zFt:-48.246},
    {xFt:-16.258,zFt:-36.996},{xFt:-16.614,zFt:-36.405},{xFt:-9.508,zFt:-32.141},
    {xFt:-9.240,zFt:-31.980},{xFt:6.386,zFt:-22.604},{xFt:9.233,zFt:-20.896},
    {xFt:10.274,zFt:-22.630},{xFt:26.507,zFt:-12.890},
  ] satisfies SitePoint[],
  buildingFootprintSqFt: 1296.65,
  houseFinishedSqFt: 2307,
  existingTrees: [] as const,
} as const

export function isInsidePickwickProperty(point: SitePoint): boolean {
  let inside=false
  const polygon=pickwickProperty.boundary
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j]
    const crosses=(a.zFt>point.zFt)!==(b.zFt>point.zFt)
    if(crosses&&point.xFt<(b.xFt-a.xFt)*(point.zFt-a.zFt)/(b.zFt-a.zFt)+a.xFt)inside=!inside
  }
  return inside
}

