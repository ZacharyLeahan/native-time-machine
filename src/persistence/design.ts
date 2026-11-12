import type { PropertyDesign } from '../types'
import { pickwickProperty } from '../data/pickwickProperty'

export const STORAGE_KEY = 'landscape-time-machine/design/v8'
export const defaultDesign: PropertyDesign = { version: 8, siteId: '15-pickwick-ln-malvern-pa', name: '15 Pickwick Ln landscape', widthFt: 210, depthFt: 210, plants: [...pickwickProperty.existingTrees] }

export function serializeDesign(design: PropertyDesign): string { return JSON.stringify(design, null, 2) }

export function parseDesign(json: string): PropertyDesign {
  const value: unknown = JSON.parse(json)
  if (!value || typeof value !== 'object') throw new Error('Design must be an object.')
  const design = value as Partial<PropertyDesign>
  if (design.version !== 8 || typeof design.siteId !== 'string' || typeof design.widthFt !== 'number' || typeof design.depthFt !== 'number' || !Array.isArray(design.plants)) throw new Error('Unsupported or invalid design file.')
  for (const plant of design.plants) {
    if (!plant || typeof plant.id !== 'string' || typeof plant.speciesId !== 'string' || !Number.isFinite(plant.xFt) || !Number.isFinite(plant.zFt)) throw new Error('Design contains an invalid plant.')
  }
  return { ...defaultDesign, ...design } as PropertyDesign
}

export function loadDesign(storage: Pick<Storage, 'getItem'> = localStorage): PropertyDesign {
  const saved = storage.getItem(STORAGE_KEY)
  if (!saved) return defaultDesign
  try { return parseDesign(saved) } catch { return defaultDesign }
}

export function saveDesign(design: PropertyDesign, storage: Pick<Storage, 'setItem'> = localStorage): void { storage.setItem(STORAGE_KEY, serializeDesign(design)) }
