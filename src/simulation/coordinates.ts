export interface ScreenPoint { x: number; y: number }
export interface YardPoint { xFt: number; zFt: number }

export function siteToWorld(point: YardPoint): { x: number; z: number } {
  return { x: point.xFt, z: -point.zFt }
}

export function worldToSite(point: { x: number; z: number }): YardPoint {
  return { xFt: point.x, zFt: -point.z }
}

export function yardToNormalized(point: YardPoint, widthFt: number, depthFt: number): ScreenPoint {
  return { x: point.xFt / widthFt + .5, y: .5 - point.zFt / depthFt }
}

export function normalizedToYard(point: ScreenPoint, widthFt: number, depthFt: number): YardPoint {
  return { xFt: (point.x - .5) * widthFt, zFt: (.5 - point.y) * depthFt }
}

export function clampToYard(point: YardPoint, widthFt: number, depthFt: number, marginFt = 0): YardPoint {
  return { xFt: Math.max(-widthFt/2 + marginFt, Math.min(widthFt/2 - marginFt, point.xFt)), zFt: Math.max(-depthFt/2 + marginFt, Math.min(depthFt/2 - marginFt, point.zFt)) }
}
