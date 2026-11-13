import { catalogById } from '../data/catalog'

export const FAVORITES_KEY = 'native-time-machine/favorites/v1'
export const DEFAULT_FAVORITES = ['white-oak','red-maple','eastern-redbud','serviceberry']
export const MAX_FAVORITES = 4

export function sanitizeFavorites(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id==='string' && catalogById.get(id)?.catalogVisible!==false && catalogById.has(id)))].slice(0,MAX_FAVORITES) : [...DEFAULT_FAVORITES]
}
export function loadFavorites(storage: Pick<Storage,'getItem'>): string[] {
  try { const raw=storage.getItem(FAVORITES_KEY); return raw===null?[...DEFAULT_FAVORITES]:sanitizeFavorites(JSON.parse(raw)) } catch { return [...DEFAULT_FAVORITES] }
}
