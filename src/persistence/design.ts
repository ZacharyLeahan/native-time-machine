import type { PropertyDesign } from '../types'
import { pickwickProperty } from '../data/pickwickProperty'
import { catalogById } from '../data/catalog'
import { placementError } from '../simulation/placement'

export const STORAGE_KEY = 'landscape-time-machine/design/v8'
export const defaultDesign: PropertyDesign = { version: 8, siteId: '15-pickwick-ln-malvern-pa', name: '15 Pickwick Ln landscape', widthFt: 210, depthFt: 210, plants: [...pickwickProperty.existingTrees] }

export function serializeDesign(design: PropertyDesign): string { return JSON.stringify(design, null, 2) }

export function parseDesign(json: string, validatePlacement = true): PropertyDesign {
  const value: unknown = JSON.parse(json)
  if (!value || typeof value !== 'object') throw new Error('Design must be an object.')
  const design = value as Partial<PropertyDesign>
  if (design.version !== 8 || design.siteId !== defaultDesign.siteId || typeof design.name !== 'string' || !Number.isFinite(design.widthFt) || !Number.isFinite(design.depthFt) || design.widthFt! <= 0 || design.depthFt! <= 0 || !Array.isArray(design.plants)) throw new Error('Unsupported or invalid design file. Choose a version 8 design for 15 Pickwick Lane.')
  const ids=new Set<string>()
  for (const plant of design.plants) {
    if (!plant || typeof plant.id !== 'string' || !plant.id.trim() || ids.has(plant.id) || !catalogById.has(plant.speciesId) || !Number.isFinite(plant.xFt) || !Number.isFinite(plant.zFt) || !Number.isFinite(plant.plantedYear) || plant.plantedYear < 0) throw new Error('Design contains an invalid plant, unknown species, or duplicate ID.')
    ids.add(plant.id)
    if(plant.origin!==undefined&&!['user','existing-inferred','existing-lidar'].includes(plant.origin))throw new Error('Invalid plant origin.')
    if(plant.confidence!==undefined&&!['high','medium','low'].includes(plant.confidence))throw new Error('Invalid confidence.')
    if((plant.measuredHeightFt===undefined)!==(plant.measuredWidthFt===undefined))throw new Error('Measured height and width must be supplied together.')
    for(const v of [plant.measuredHeightFt,plant.measuredWidthFt])if(v!==undefined&&(!Number.isFinite(v)||v<=0))throw new Error('Measured dimensions must be positive.')
    if(plant.measurementYear!==undefined&&(!Number.isInteger(plant.measurementYear)||plant.measurementYear<0))throw new Error('Invalid measurement year.')
    if(plant.measurementSource!==undefined&&typeof plant.measurementSource!=='string')throw new Error('Invalid measurement source.')
    const error=placementError(plant.xFt,plant.zFt)
    if(validatePlacement&&error)throw new Error(`Plant ${plant.id}: ${error}`)
  }
  return { ...defaultDesign, ...design } as PropertyDesign
}

export function loadDesign(storage: Pick<Storage, 'getItem'> = localStorage): PropertyDesign {
  try { const saved=storage.getItem(STORAGE_KEY); return saved?parseDesign(saved,false):defaultDesign } catch { return defaultDesign }
}

export function saveDesign(design: PropertyDesign, storage: Pick<Storage, 'getItem'|'setItem'> = localStorage): void {
  const previous=storage.getItem(STORAGE_KEY)
  if(previous&&!storage.getItem(`${STORAGE_KEY}/backup`))storage.setItem(`${STORAGE_KEY}/backup`,previous)
  storage.setItem(STORAGE_KEY,serializeDesign(design))
}
