import { useMemo } from 'react'
import { usePlannerStore } from '../store/usePlannerStore'
import { pickwickProperty } from '../data/pickwickProperty'
import { recordedLot49Boundary } from '../data/recordedLot49'
import { measurePlacement, measurementSubject } from '../simulation/measurements'

export function usePlacementMeasurements() {
  const design=usePlannerStore(s=>s.design),selectedId=usePlannerStore(s=>s.selectedPlantId),carry=usePlannerStore(s=>s.walkCarry),mode=usePlannerStore(s=>s.viewMode),recorded=usePlannerStore(s=>s.recordedBoundary)
  const measurements=useMemo(()=>{
    const subject=measurementSubject(design.plants,selectedId,carry,mode)
    return subject?measurePlacement(subject,design.plants,recorded?recordedLot49Boundary:pickwickProperty.boundary):null
  },[design,selectedId,carry,mode,recorded])
  return {measurements,source:recorded?'Lot 49 fitted plan':'County GIS',recorded}
}
