import { useMemo } from 'react'
import { usePlannerStore } from '../store/usePlannerStore'
import { displayBoundary } from '../data/displayBoundary'
import { measurePlacement, measurementSubject } from '../simulation/measurements'

export function usePlacementMeasurements() {
  const design=usePlannerStore(s=>s.design),selectedId=usePlannerStore(s=>s.selectedPlantId),carry=usePlannerStore(s=>s.walkCarry),mode=usePlannerStore(s=>s.viewMode),recorded=usePlannerStore(s=>s.recordedBoundary)
  const aligned=usePlannerStore(s=>s.aerialAligned),boundary=displayBoundary(recorded,aligned)
  const marked=usePlannerStore(s=>s.walkMarked),target=usePlannerStore(s=>s.walkTargetId),group=usePlannerStore(s=>s.walkArrangement)
  const measurements=useMemo(()=>{
    const plants=group?design.plants.map(p=>group.preview.find(q=>q.id===p.id)??p):design.plants
    const subject=measurementSubject(plants,selectedId,carry,mode,marked,target)
    return subject?measurePlacement(subject,plants,boundary.points):null
  },[design,selectedId,carry,mode,boundary.points,marked,target,group])
  return {measurements,source:boundary.label,recorded}
}
