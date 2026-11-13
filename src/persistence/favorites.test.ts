import { describe,it,expect } from 'vitest'
import { DEFAULT_FAVORITES, loadFavorites, sanitizeFavorites } from './favorites'
import { equipmentForFavorites } from '../simulation/controller'

describe('persistent plant kit',()=>{
  it('handles missing, malformed, duplicate, hidden and retired species',()=>{
    expect(loadFavorites({getItem:()=>null})).toEqual(DEFAULT_FAVORITES)
    expect(loadFavorites({getItem:()=>'{broken'})).toEqual(DEFAULT_FAVORITES)
    expect(sanitizeFavorites(['pawpaw','pawpaw','unknown','existing-canopy',4,'red-maple'])).toEqual(['pawpaw','red-maple'])
    expect(loadFavorites({getItem:()=> '[]'})).toEqual([])
  })
  it('maps favorites in order while preserving all six Xbox sectors',()=>{
    const kit=equipmentForFavorites(['pawpaw','american-hazelnut'])
    expect(kit).toHaveLength(6)
    expect(kit.slice(0,2).map(i=>i.speciesId)).toEqual(['pawpaw','american-hazelnut'])
    expect(kit[2].action).toBe('empty')
    expect(kit[4].action).toBe('move')
    expect(kit[5].action).toBe('cancel')
  })
})
