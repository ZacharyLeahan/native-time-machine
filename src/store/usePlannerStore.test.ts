import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlannerStore as store } from './usePlannerStore'
import { defaultDesign } from '../persistence/design'
import { placementError } from '../simulation/placement'
import { DEFAULT_FAVORITES, FAVORITES_KEY } from '../persistence/favorites'
import { measurePlacement } from '../simulation/measurements'
import { pickwickProperty } from '../data/pickwickProperty'

beforeEach(()=>store.setState({viewMode:'garden',favorites:[...DEFAULT_FAVORITES],cameraShortcut:null,walkCarry:null,design:{...defaultDesign,plants:[]},past:[],future:[],moveBaseline:null,selectedPlantId:null,notice:null}))
afterEach(()=>vi.unstubAllGlobals())
describe('design editing',()=>{
  it('compares all boundary alignments without editing saved plants or undo history',()=>{
    store.getState().placePlant('white-oak',0,0)
    const design=store.getState().design,history=store.getState().past
    for(const view of ['aerial','recorded','gis'] as const){
      store.getState().setBoundaryView(view)
      expect(store.getState().recordedBoundary).toBe(view!=='gis')
      expect(store.getState().aerialAligned).toBe(view==='aerial')
      expect(store.getState().design).toBe(design);expect(store.getState().past).toBe(history)
    }
  })
  it('updates measurements through a drag and restores positions with a single undo',()=>{
    store.getState().placePlant('white-oak',0,0)
    const id=store.getState().design.plants[0].id
    store.getState().placePlant('red-maple',20,0)
    const original=store.getState().design,historyLength=store.getState().past.length
    store.getState().selectPlant(id);store.getState().beginMove()
    store.getState().movePlant(id,10,0)
    let state=store.getState()
    expect(measurePlacement(state.design.plants[0],state.design.plants,pickwickProperty.boundary).neighbor?.distanceFt).toBe(10)
    store.getState().movePlant(id,15,0);store.getState().endMove();state=store.getState()
    expect(measurePlacement(state.design.plants[0],state.design.plants,pickwickProperty.boundary).neighbor?.distanceFt).toBe(5)
    expect(state.past).toHaveLength(historyLength+1)
    store.getState().undo();expect(store.getState().design).toBe(original)
  })
  it('keeps measurement boundary and coordinate-grid controls out of design data and undo history',()=>{
    const design=store.getState().design,history=store.getState().past
    store.setState({recordedBoundary:true,coordinateGrid:false})
    store.getState().toggleBoundary();store.getState().toggleCoordinateGrid()
    expect(store.getState().recordedBoundary).toBe(false);expect(store.getState().coordinateGrid).toBe(true)
    expect(store.getState().design).toBe(design);expect(store.getState().past).toBe(history)
    expect(store.getState().design).not.toHaveProperty('coordinateGrid')
    store.getState().toggleBoundary();store.getState().toggleCoordinateGrid()
  })
  it('persists favorites separately and equips a replacement without changing any placements or history',()=>{
    const setItem=vi.fn();vi.stubGlobal('localStorage',{setItem})
    const original=store.getState().design
    store.getState().toggleFavorite('white-oak');store.getState().toggleFavorite('pawpaw')
    expect(setItem).toHaveBeenLastCalledWith(FAVORITES_KEY,JSON.stringify(['red-maple','eastern-redbud','serviceberry','pawpaw']))
    store.getState().chooseEquipment(3,5,8)
    expect(store.getState().walkCarry?.speciesId).toBe('pawpaw')
    store.getState().toggleFavorite('american-hazelnut')
    expect(store.getState().favorites).toHaveLength(4)
    expect(store.getState().notice).toContain('four')
    expect(store.getState().design).toBe(original);expect(store.getState().past).toHaveLength(0)
  })
  it('keeps empty wheel slots inert and camera shortcuts out of undo and design data',()=>{
    store.setState({favorites:[],walkCarry:{id:'preview',speciesId:'pawpaw',xFt:0,zFt:0}})
    const original=store.getState().design
    store.getState().chooseEquipment(0,0,0)
    expect(store.getState().walkCarry?.speciesId).toBe('pawpaw')
    store.getState().requestCamera('front')
    expect(store.getState().cameraShortcut?.preset).toBe('front')
    expect(store.getState().design).toBe(original);expect(store.getState().past).toHaveLength(0)
    store.getState().setViewMode('walk');expect(store.getState().cameraShortcut).toBeNull()
    store.getState().requestCamera('selected');expect(store.getState().viewMode).toBe('walk')
  })
  it('focuses a selected plant from Plan without modifying its location and can repeat the shot',()=>{
    store.getState().placePlant('white-oak',0,0)
    const original=store.getState().design,history=store.getState().past
    store.getState().setViewMode('planner')
    store.getState().requestCamera('selected')
    expect(store.getState().viewMode).toBe('garden')
    expect(store.getState().selectedPlantId).toBe(original.plants[0].id)
    const first=store.getState().cameraShortcut?.id
    store.getState().requestCamera('selected')
    expect(store.getState().cameraShortcut?.id).not.toBe(first)
    expect(store.getState().design).toBe(original);expect(store.getState().past).toBe(history)
    store.getState().resetCamera();expect(store.getState().cameraShortcut).toBeNull()
  })
  it('blocks every design mutation and equipment action in spectator mode',()=>{
    store.getState().placePlant('white-oak',0,0)
    const original=store.getState().design,id=original.plants[0].id
    store.getState().setViewMode('spectator')
    const history=store.getState().past.length
    store.getState().placePlant('red-maple',10,0)
    store.getState().movePlant(id,20,0)
    store.getState().duplicatePlant(id);store.getState().deletePlant(id)
    store.getState().undo();store.getState().redo();store.getState().resetDesign()
    store.getState().importDesign(JSON.stringify(defaultDesign))
    store.getState().chooseEquipment(0,0,0)
    expect(store.getState().dropCarried(10,0,0,0)).toBe(false)
    expect(store.getState().design).toBe(original)
    expect(store.getState().past).toHaveLength(history)
    expect(store.getState().walkCarry).toBeNull()
  })
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
