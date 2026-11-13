import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlannerStore as store } from './usePlannerStore'
import { defaultDesign } from '../persistence/design'
import { placementError } from '../simulation/placement'

beforeEach(()=>store.setState({design:{...defaultDesign,plants:[]},past:[],future:[],moveBaseline:null,selectedPlantId:null,notice:null}))
afterEach(()=>vi.unstubAllGlobals())
describe('design editing',()=>{
  it('leaves the design and undo history untouched when the wheel is cancelled or a drop is invalid',()=>{
    const original=store.getState().design
    store.getState().chooseEquipment(1,0,0)
    expect(store.getState().dropCarried(999,999,0,0)).toBe(false)
    expect(store.getState().design).toBe(original)
    expect(store.getState().past).toHaveLength(0)
    store.getState().chooseEquipment(null,0,0)
    expect(store.getState().walkCarry?.speciesId).toBe('red-maple')
    store.getState().chooseEquipment(5,0,0)
    expect(store.getState().walkCarry).toBeNull()
    expect(store.getState().design).toBe(original)
  })
  it('equips a wheel plant without saving it, then plants once and supports undo',()=>{
    const original=store.getState().design
    store.getState().chooseEquipment(0,0,0)
    expect(store.getState().design).toBe(original)
    expect(store.getState().dropCarried(0,0,0,-10)).toBe(true)
    expect(store.getState().design.plants).toHaveLength(1)
    expect(store.getState().dropCarried(0,0,0,-10)).toBe(false)
    store.getState().undo();expect(store.getState().design).toBe(original)
  })
  it('rejects a drop through the house and preserves a held tree until cancel',()=>{
    store.getState().placePlant('white-oak',0,0)
    const original=store.getState().design,id=original.plants[0].id
    store.setState({walkCarry:{id,xFt:0,zFt:0}})
    expect(store.getState().dropCarried(0,0,0,-80)).toBe(false)
    expect(store.getState().design).toBe(original)
    expect(store.getState().walkCarry?.id).toBe(id)
    store.getState().chooseEquipment(5,0,0)
    expect(store.getState().walkCarry).toBeNull()
    expect(store.getState().design).toBe(original)
  })
  it('keeps carry previews out of the saved design, drops undoably, and cancels on exit',()=>{
    store.getState().placePlant('white-oak',0,0)
    const original=store.getState().design,id=original.plants[0].id
    store.setState({walkCarry:{id,xFt:10,zFt:0}})
    expect(store.getState().design).toBe(original)
    store.getState().movePlant(id,10,0)
    store.setState({walkCarry:null})
    store.getState().undo();expect(store.getState().design).toBe(original)
    store.setState({walkCarry:{id,xFt:20,zFt:0}})
    store.getState().setViewMode('garden')
    expect(store.getState().walkCarry).toBeNull()
    expect(store.getState().design).toBe(original)
  })
  it('reports save failures without modifying the current design',()=>{
    store.getState().placePlant('white-oak',0,0)
    const original=store.getState().design
    vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{throw new Error('quota')}})
    store.getState().autosave()
    expect(store.getState().saveStatus).toContain('Could not save')
    expect(store.getState().design).toBe(original)
  })
  it('rejects house and outside placement without changing history',()=>{
    store.getState().placePlant('white-oak',0,-40)
    store.getState().placePlant('white-oak',1000,0)
    expect(store.getState().design.plants).toHaveLength(0)
    expect(store.getState().past).toHaveLength(0)
  })
  it('undoes and redoes a complete drag as one action',()=>{
    store.getState().placePlant('white-oak',0,0)
    const id=store.getState().design.plants[0].id
    store.getState().beginMove()
    for(const x of [1,2,3])store.getState().movePlant(id,x,0)
    store.getState().endMove()
    expect(store.getState().past).toHaveLength(2)
    store.getState().undo();expect(store.getState().design.plants[0].xFt).toBe(0)
    store.getState().redo();expect(store.getState().design.plants[0].xFt).toBe(3)
    store.getState().deletePlant(id);store.getState().undo()
    expect(store.getState().design.plants[0].id).toBe(id)
  })
  it('duplicates only into valid locations and clears redo on a new edit',()=>{
    store.getState().placePlant('white-oak',0,0)
    store.getState().duplicatePlant(store.getState().design.plants[0].id)
    expect(store.getState().design.plants).toHaveLength(2)
    for(const p of store.getState().design.plants)expect(placementError(p.xFt,p.zFt)).toBeNull()
    store.getState().undo();store.getState().placePlant('white-oak',10,0)
    expect(store.getState().future).toHaveLength(0)
  })
  it('rejects invalid movement and preserves the original plant',()=>{
    store.getState().placePlant('white-oak',0,0)
    const original=store.getState().design
    store.getState().beginMove()
    store.getState().movePlant(original.plants[0].id,0,-40)
    store.getState().endMove()
    expect(store.getState().design).toBe(original)
    expect(store.getState().past).toHaveLength(1)
  })
  it('failed imports preserve design and successful imports are undoable',()=>{
    store.getState().placePlant('white-oak',0,0)
    const original=store.getState().design
    expect(()=>store.getState().importDesign('{}')).toThrow()
    expect(store.getState().design).toBe(original)
    store.getState().importDesign(JSON.stringify(defaultDesign))
    store.getState().undo();expect(store.getState().design).toBe(original)
    store.getState().resetDesign();store.getState().undo();expect(store.getState().design).toBe(original)
  })
})
