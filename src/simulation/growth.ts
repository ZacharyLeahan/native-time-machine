import type { PlantInstance, PlantSpecies } from '../types'

export interface PlantDimensions { heightFt: number; widthFt: number; maturity: number }

export function growthProgress(ageYears: number, species: PlantSpecies): number {
  const age = Math.max(0, ageYears)
  const { establishmentYears, halfMaturityYears, maturityYears } = species.growth
  if (age >= maturityYears) return 1
  if (age <= establishmentYears) return 0.08 * (age / Math.max(establishmentYears, 0.1))
  const normalized = (age - establishmentYears) / Math.max(halfMaturityYears - establishmentYears, 0.1)
  const rate = Math.log(9)
  const logistic = 1 / (1 + Math.exp(-rate * (normalized - 1)))
  const atStart = 1 / (1 + Math.exp(rate))
  const atMaturity = 1 / (1 + Math.exp(-rate * (((maturityYears - establishmentYears) / Math.max(halfMaturityYears - establishmentYears, .1)) - 1)))
  return Math.min(1, 0.08 + 0.92 * ((logistic - atStart) / (atMaturity - atStart)))
}

export function dimensionsAtYear(species: PlantSpecies, year: number, plantedYear = 0): PlantDimensions {
  const maturity = growthProgress(year - plantedYear, species)
  const matureHeight = (species.matureHeightFt[0] + species.matureHeightFt[1]) / 2
  const matureWidth = (species.matureWidthFt[0] + species.matureWidthFt[1]) / 2
  return {
    heightFt: species.growth.initialHeightFt + (matureHeight - species.growth.initialHeightFt) * maturity,
    widthFt: species.growth.initialWidthFt + (matureWidth - species.growth.initialWidthFt) * Math.pow(maturity, .88),
    maturity,
  }
}

export function dimensionsForPlantAtYear(species: PlantSpecies, plant: PlantInstance, year: number): PlantDimensions {
  if (plant.measuredHeightFt && plant.measuredWidthFt) {
    // Mature existing trees change slowly compared with newly planted material.
    // Keep the measured baseline honest and apply only conservative future growth.
    const futureYears = Math.max(0, year)
    const matureHeight = (species.matureHeightFt[0] + species.matureHeightFt[1]) / 2
    return {
      heightFt: plant.measuredHeightFt * (1 + futureYears * .002),
      widthFt: plant.measuredWidthFt * (1 + futureYears * .004),
      maturity: Math.min(1, plant.measuredHeightFt / matureHeight),
    }
  }
  return dimensionsAtYear(species, year, plant.plantedYear)
}
