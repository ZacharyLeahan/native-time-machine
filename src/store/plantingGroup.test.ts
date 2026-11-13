import { beforeEach,describe,it,expect } from 'vitest'
import { usePlannerStore as store } from './usePlannerStore'
import { defaultDesign,serializeDesign,parseDesign } from '../persistence/design'
import { plantingCoordinates } from '../simulation/plantingGroup'
function fixture(){
  store.setState({viewMode:'walk',design:{...defaultDesign,plants:[]},past:[],future:[],moveBaseline:null,walkMarked:[],walkArrangement:null,walkCarry:null,walkTargetId:null,walkSelecting:false,walkDeleteId:null,walkInspectId:null,recordedBoundary:true,aerialAligned:true})
  store.getState().placePlant('white-oak',-20,0);store.getState().placePlant('red-maple',0,0);store.getState().placePlant('pawpaw',20,0)
  store.setState({past:[],future:[]})
  return store.getState().design
}
beforeEach(fixture)
describe('Walk planting group transactions',()=>{
  it('single-selection Duplicate creates and selects one copy with one-step undo',()=>{
    const original=store.getState().design,id=original.plants[0].id
    store.getState().selectWalkPlant(id);store.getState().chooseEquipment(2,0,0)
    const s=store.getState()
    expect(s.design.plants).toHaveLength(4);expect(s.walkMarked).toEqual([s.selectedPlantId]);expect(s.selectedPlantId).not.toBe(id)
    expect(s.design.plants.find(p=>p.id===s.selectedPlantId)?.speciesId).toBe(original.plants[0].speciesId)
    expect(s.past).toHaveLength(1);s.undo();expect(store.getState().design).toBe(original)
  })
  it('multiple-selection sector 2 distributes a preview instead of duplicating or adding a plant',()=>{
    const original=store.getState().design
    original.plants.forEach(p=>store.getState().selectWalkPlant(p.id));store.getState().chooseEquipment(2,0,0)
    expect(store.getState().walkArrangement?.preview).toHaveLength(3);expect(store.getState().design).toBe(original);expect(store.getState().past).toHaveLength(0)
  })
  it('Inspect and delete review leave serialization intact; Cancel keeps the selection',()=>{
    const original=store.getState().design,id=original.plants[0].id,before=serializeDesign(original)
    store.getState().selectWalkPlant(id);store.getState().chooseEquipment(3,0,0)
    expect(store.getState().walkInspectId).toBe(id)
    store.getState().chooseEquipment(4,0,0);expect(store.getState().walkDeleteId).toBe(id)
    expect(serializeDesign(store.getState().design)).toBe(before)
    store.getState().cancelWalkDelete();expect(store.getState().walkMarked).toEqual([id]);expect(store.getState().design).toBe(original)
  })
  it('Spectator clears delete review and cannot confirm a stale deletion',()=>{
    const original=store.getState().design
    store.getState().selectWalkPlant(original.plants[0].id);store.getState().selectionAction('delete');store.getState().setViewMode('spectator')
    expect(store.getState().walkDeleteId).toBeNull();store.getState().confirmWalkDelete();expect(store.getState().design).toBe(original)
  })
  it('orients wheel-created group movement toward camera-right even when facing the opposite way',()=>{
    store.getState().design.plants.forEach(p=>store.getState().toggleWalkMark(p.id))
    store.getState().chooseEquipment(0,0,0,Math.PI)
    const frame=store.getState().walkArrangement!.frame
    expect(frame.along.xFt*Math.cos(Math.PI)+frame.along.zFt*Math.sin(Math.PI)).toBeGreaterThanOrEqual(0)
  })
  it('leaves plants outside the marked group unchanged',()=>{
    const original=store.getState().design
    store.getState().startArrangement(original.plants.slice(0,2).map(p=>p.id));store.getState().moveArrangement(1,0)
    expect(store.getState().applyArrangement()).toBe(true)
    expect(store.getState().design.plants[2]).toBe(original.plants[2])
  })
  it('previews an arrangement and whole-foot nudges without touching serialized placements',()=>{
    const original=store.getState().design,before=serializeDesign(original)
    original.plants.forEach(p=>store.getState().toggleWalkMark(p.id));store.getState().startArrangement();store.getState().arrangeGroup('row');store.getState().moveArrangement(1,1,true)
    expect(serializeDesign(store.getState().design)).toBe(before);expect(store.getState().past).toHaveLength(0)
    const group=store.getState().walkArrangement!,setbacks=group.preview.map(p=>plantingCoordinates(p,group.frame).away)
    expect(new Set(setbacks.map(v=>v.toFixed(6))).size).toBe(1);expect(setbacks[0]).toBeCloseTo(Math.round(setbacks[0]))
    store.getState().cancelArrangement();expect(store.getState().design).toBe(original)
  })
  it('commits all positions atomically and supports one-step undo and redo',()=>{
    const original=store.getState().design
    store.getState().startArrangement(original.plants.map(p=>p.id));store.getState().moveArrangement(1,0)
    expect(store.getState().applyArrangement()).toBe(true)
    const moved=store.getState().design
    expect(store.getState().past).toHaveLength(1);expect(moved.plants.every((p,i)=>p.id===original.plants[i].id)).toBe(true)
    expect(parseDesign(serializeDesign(moved))).toEqual(moved)
    store.getState().undo();expect(store.getState().design).toBe(original)
    store.getState().redo();expect(store.getState().design).toBe(moved)
  })
  it('rejects the entire preview if even one member would leave the parcel',()=>{
    const original=store.getState().design
    store.getState().startArrangement(original.plants.map(p=>p.id));store.getState().moveArrangement(1000,0)
    expect(store.getState().walkArrangement?.error).toBeTruthy();expect(store.getState().applyArrangement()).toBe(false)
    expect(store.getState().design).toBe(original);expect(store.getState().past).toHaveLength(0)
  })
  it('does not commit a stale preview after external design changes',()=>{
    store.getState().startArrangement(store.getState().design.plants.map(p=>p.id));store.getState().moveArrangement(1,0)
    const changed={...store.getState().design,label:'Changed elsewhere'};store.setState({design:changed})
    expect(store.getState().applyArrangement()).toBe(false);expect(store.getState().design).toBe(changed)
    expect(store.getState().walkArrangement?.error).toContain('Design changed')
  })
  it('discards previews and marks on mode changes, and Spectator cannot start or apply them',()=>{
    const original=store.getState().design
    store.getState().toggleWalkMark(original.plants[0].id);store.getState().startArrangement();store.getState().moveArrangement(1,0)
    store.getState().setViewMode('spectator');expect(store.getState().walkMarked).toEqual([]);expect(store.getState().walkArrangement).toBeNull()
    store.getState().startArrangement(original.plants.map(p=>p.id));store.getState().toggleWalkMark(original.plants[0].id)
    expect(store.getState().applyArrangement()).toBe(false);expect(store.getState().walkMarked).toEqual([]);expect(store.getState().design).toBe(original)
  })
  it('does not create an undo entry when picking up and applying without a move',()=>{
    const original=store.getState().design
    store.getState().startArrangement([original.plants[0].id]);expect(store.getState().applyArrangement()).toBe(true)
    expect(store.getState().design).toBe(original);expect(store.getState().past).toHaveLength(0)
  })
  it('enters fine movement at the currently displayed single-plant carry position',()=>{
    const p=store.getState().design.plants[0]
    store.setState({walkCarry:{id:p.id,xFt:p.xFt+3,zFt:p.zFt+4}});store.getState().startArrangement([p.id])
    expect(store.getState().walkArrangement?.preview[0]).toMatchObject({xFt:p.xFt+3,zFt:p.zFt+4});expect(store.getState().walkCarry).toBeNull()
  })
})
