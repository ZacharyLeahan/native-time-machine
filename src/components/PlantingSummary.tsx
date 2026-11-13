import { useEffect, useRef } from 'react'
import { usePlannerStore } from '../store/usePlannerStore'
import { plantingSummary } from '../simulation/plantingSummary'

export function PlantingSummary({onClose}:{onClose:()=>void}) {
  const design=usePlannerStore(s=>s.design),year=usePlannerStore(s=>s.year)
  const dialog=useRef<HTMLDialogElement>(null)
  const rows=plantingSummary(design,year)
  const planned=rows.reduce((n,r)=>n+r.plants.filter(p=>!p.existing).length,0)
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close()},[])
  return <dialog ref={dialog} className="planting-summary" aria-labelledby="summary-title" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="summary-header"><div><span className="eyebrow">Your landscape</span><h2 id="summary-title">Planting summary</h2></div><button onClick={onClose} autoFocus aria-label="Close planting summary">Close</button></div>
    <p>{design.plants.length} plants · {rows.length} species · {planned} planned · {design.plants.length-planned} existing</p>
    <p className="summary-note">Year {year} dimensions are approximate. X/Z are trunk or plant centers in feet in the site's coordinate system; they are not distances from a surveyed property corner. Existing plants are excluded from the planned purchase count.</p>
    {rows.length===0?<p>No plants placed yet. Choose a native from the library to get started.</p>:<div className="summary-table-wrap"><table><caption>Plant locations and estimated size at year {year}</caption><thead><tr><th scope="col">Species / quantity</th><th scope="col">Plant</th><th scope="col">Center X / Z (ft)</th><th scope="col">Height / canopy (ft)</th></tr></thead><tbody>{rows.flatMap(row=>row.plants.map((plant,index)=><tr key={plant.id}><th scope="row">{row.commonName}<small>{row.scientificName} · {row.plants.length} total</small></th><td>{index+1} · {plant.existing?'Existing':'Planned'}</td><td>{plant.xFt.toFixed(1)} / {plant.zFt.toFixed(1)}</td><td>{plant.heightFt.toFixed(1)} / {plant.widthFt.toFixed(1)}</td></tr>))}</tbody></table></div>}
  </dialog>
}
