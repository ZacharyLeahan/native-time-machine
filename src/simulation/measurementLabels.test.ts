import { describe,expect,it } from 'vitest'
import { boxesOverlap,layoutMeasurementLabels,type LabelAnchor } from './measurementLabels'
const rectangle=(label:LabelAnchor,position:[number,number])=>({x:position[0]-label.width/2,y:position[1]-label.height/2,width:label.width,height:label.height})
describe('measurement-label layout',()=>{
  it('keeps crowded dimensions clear of the plant label, controls, and each other',()=>{
    const subject={x:414,y:222},anchors=[{key:'boundary',x:448,y:202,width:130,height:25},{key:'plant',x:384,y:227,width:144,height:25}],controls={x:0,y:0,width:750,height:155}
    const positions=layoutMeasurementLabels(subject,anchors,{width:750,height:559},[controls])
    const boxes=anchors.map(anchor=>rectangle(anchor,positions[anchor.key]))
    for(const box of boxes){
      expect(boxesOverlap(box,{x:329,y:174,width:170,height:64})).toBe(false)
      expect(boxesOverlap(box,controls)).toBe(false)
    }
    expect(boxesOverlap(boxes[0],boxes[1])).toBe(false)
  })
  it('keeps labels inside a narrow viewport near its edges',()=>{
    const anchors=[{key:'boundary',x:5,y:10,width:180,height:25},{key:'plant',x:345,y:450,width:150,height:25}]
    const positions=layoutMeasurementLabels({x:175,y:250},anchors,{width:350,height:460})
    for(const anchor of anchors){
      const box=rectangle(anchor,positions[anchor.key])
      expect(box.x).toBeGreaterThanOrEqual(8);expect(box.x+box.width).toBeLessThanOrEqual(342)
      expect(box.y).toBeGreaterThanOrEqual(8);expect(box.y+box.height).toBeLessThanOrEqual(452)
    }
  })
  it('places a vertical dimension label beside its line rather than over it',()=>{
    const anchor={key:'boundary',x:300,y:220,width:150,height:25}
    const result=layoutMeasurementLabels({x:300,y:350},[anchor],{width:750,height:559})
    expect(Math.abs(result.boundary[0]-300)).toBeGreaterThan(anchor.width/2)
  })
  it('is deterministic for coincident projected points without changing world inputs',()=>{
    const anchor={key:'plant',x:100,y:200,width:120,height:25},subject={x:100,y:200},before=JSON.stringify({anchor,subject})
    const result=layoutMeasurementLabels(subject,[anchor],{width:350,height:460})
    expect(result.plant.every(Number.isFinite)).toBe(true)
    expect(layoutMeasurementLabels(subject,[anchor],{width:350,height:460})).toEqual(result)
    expect(JSON.stringify({anchor,subject})).toBe(before)
  })
})
