import { describe, expect, it } from 'vitest'
import { defaultDesign, loadDesign, parseDesign, saveDesign, serializeDesign, STORAGE_KEY } from './design'
import type { PropertyDesign } from '../types'

describe('design persistence', () => {
  const design: PropertyDesign = { ...defaultDesign, plants: [{ id: 'p1', speciesId: 'white-oak', xFt: 4, zFt: -7, plantedYear: 0 }] }

  it('round-trips a design without losing measurements', () => {
    expect(parseDesign(serializeDesign(design))).toEqual(design)
  })

  it('rejects unsupported or malformed data', () => {
    expect(() => parseDesign('{"version":1,"plants":[]}')).toThrow('invalid')
    expect(() => parseDesign(JSON.stringify({...design,plants:[{}]}))).toThrow('invalid plant')
  })
  it('rejects wrong sites, unknown species, duplicate IDs, missing ages and invalid positions',()=>{
    for(const value of [
      {...design,siteId:'another-site'},
      {...design,plants:[{...design.plants[0],speciesId:'unknown'}]},
      {...design,plants:[design.plants[0],design.plants[0]]},
      {...design,plants:[{...design.plants[0],plantedYear:undefined}]},
      {...design,plants:[{...design.plants[0],xFt:1000}]},
      {...design,plants:[{...design.plants[0],xFt:0,zFt:-40}]},
      {...design,plants:[{...design.plants[0],measuredHeightFt:-1,measuredWidthFt:10}]},
    ])expect(()=>parseDesign(JSON.stringify(value))).toThrow()
  })
  it('keeps legacy positions when loading and backs up the exact original file',()=>{
    const original=JSON.stringify({...design,plants:[{...design.plants[0],xFt:0,zFt:-40}]})
    const values=new Map([[STORAGE_KEY,original]])
    const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}}
    expect(loadDesign(storage).plants[0].zFt).toBe(-40)
    saveDesign(design,storage)
    expect(values.get(`${STORAGE_KEY}/backup`)).toBe(original)
    saveDesign({...design,name:'Later'},storage)
    expect(values.get(`${STORAGE_KEY}/backup`)).toBe(original)
  })
  it('handles unavailable storage reads',()=>{
    expect(loadDesign({getItem:()=>{throw new Error('blocked')}})).toEqual(defaultDesign)
  })
})
