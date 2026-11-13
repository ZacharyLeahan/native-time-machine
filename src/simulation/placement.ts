import { isInsidePickwickProperty, pickwickProperty } from '../data/pickwickProperty'
import { isPointInsidePolygon } from './walkNavigation'
export function placementError(xFt:number,zFt:number):string|null {
  if(!Number.isFinite(xFt)||!Number.isFinite(zFt))return 'Choose a valid position.'
  if(!isInsidePickwickProperty({xFt,zFt}))return 'Keep the plant inside the property boundary.'
  if(isPointInsidePolygon({xFt,zFt},pickwickProperty.buildingFootprint))return 'Plants cannot be placed inside the house.'
  return null
}
