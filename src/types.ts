export type Season = 'spring' | 'summer' | 'fall' | 'winter'
export type PlantType = 'Canopy tree' | 'Understory tree' | 'Shrub' | 'Perennial'

export interface GrowthCurve {
  establishmentYears: number
  halfMaturityYears: number
  maturityYears: number
  initialHeightFt: number
  initialWidthFt: number
}

export interface SeasonalPalette {
  spring: string
  summer: string
  fall: string
  winter: string
}

export interface PlantSpecies {
  id: string
  commonName: string
  scientificName: string
  type: PlantType
  matureHeightFt: [number, number]
  matureWidthFt: [number, number]
  growth: GrowthCurve
  seasons: Record<Season, string>
  palette: SeasonalPalette
  sun: string
  soil: string
  note: string
  catalogVisible?: boolean
}

export interface PlantInstance {
  id: string
  speciesId: string
  xFt: number
  zFt: number
  plantedYear: number
  origin?: 'user' | 'existing-inferred' | 'existing-lidar'
  confidence?: 'high' | 'medium' | 'low'
  measuredHeightFt?: number
  measuredWidthFt?: number
  measurementYear?: number
  measurementSource?: string
}

export interface PropertyDesign {
  version: 8
  siteId: string
  name: string
  widthFt: number
  depthFt: number
  plants: PlantInstance[]
}
