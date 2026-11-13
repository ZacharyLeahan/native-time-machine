import { pickwickProperty } from './pickwickProperty'
import { recordedLot49Boundary } from './recordedLot49'

export type BoundaryView='aerial'|'recorded'|'gis'
// Visual registration against the 2021 PEMA pavement curve. This is a rigid
// translation, not a new surveyed boundary, and never moves saved placements.
export const aerialBoundaryAlignment={eastFt:0,northFt:-14,source:'2021 PEMA pavement edge'} as const
export const aerialAlignedBoundary=recordedLot49Boundary.map(point=>({xFt:point.xFt+aerialBoundaryAlignment.eastFt,zFt:point.zFt+aerialBoundaryAlignment.northFt}))
export function displayBoundary(recorded:boolean,aligned:boolean) {
  return !recorded?{points:pickwickProperty.boundary,label:'County GIS',view:'gis' as const}:aligned?{points:aerialAlignedBoundary,label:'Aerial-aligned plan',view:'aerial' as const}:{points:recordedLot49Boundary,label:'Lot 49 GIS-anchored plan',view:'recorded' as const}
}
