import { Copy, Trash2 } from 'lucide-react'
import { catalogById } from '../data/catalog'
import { dimensionsForPlantAtYear } from '../simulation/growth'
import { usePlannerStore } from '../store/usePlannerStore'
import { PlacementMeasurementReadout } from './PlacementMeasurements'

export function DetailsPanel() {
  const design=usePlannerStore(s=>s.design),selectedId=usePlannerStore(s=>s.selectedPlantId),year=usePlannerStore(s=>s.year),season=usePlannerStore(s=>s.season)
  const remove=usePlannerStore(s=>s.deletePlant),duplicate=usePlannerStore(s=>s.duplicatePlant),select=usePlannerStore(s=>s.selectPlant)
  const plant=design.plants.find(p=>p.id===selectedId),species=plant?catalogById.get(plant.speciesId):undefined
  if(!plant||!species)return <aside className="details-panel panel site-overview">
    <div className="site-overview-hero"><span className="eyebrow">YOUR LANDSCAPE</span><h2>15 Pickwick Lane</h2><p>Malvern, Pennsylvania</p></div>
    <div className="site-metrics"><div><strong>0.485</strong><span>acres</span></div><div><strong>{design.plants.length.toString().padStart(2,'0')}</strong><span>design plants</span></div></div>
    <section className="design-index"><h3>In your design</h3>{design.plants.length?design.plants.map((entry,index)=><button key={entry.id} onClick={()=>select(entry.id)}><span>{String(index+1).padStart(2,'0')}</span>{catalogById.get(entry.speciesId)?.commonName??'Plant'}<span>↗</span></button>):<p>Select a species from the library to begin.</p>}</section>
    <details className="site-evidence"><summary>Site accuracy <span>Approximate</span></summary><p>LiDAR terrain and fitted roof. County GIS boundaries and the recorded Lot 49 plan are approximate overlays, not a survey. Pavement edges may differ from property lines.</p><p>Existing trunks are unverified. Measure each trunk from fixed house corners before relying on its position.</p></details>
    <p className="overview-hint">Select a plant to see its distances, growth, and growing preferences.</p>
  </aside>
  const dims=dimensionsForPlantAtYear(species,plant,year)
  const sourceLabel=plant.origin==='existing-lidar'?`Existing · ${plant.measurementYear} LiDAR canopy`:plant.origin==='existing-inferred'?`Existing · ${plant.confidence??'low'} confidence`:species.type
  return <aside className="details-panel panel">
    <div className="detail-hero" style={{borderTopColor:species.palette[season]}}><span>{sourceLabel}</span><h2>{species.commonName}</h2><em>{species.scientificName}</em></div>
    <div className="detail-body"><PlacementMeasurementReadout/>
      <div className="now-grid"><div><span>Height · year {year}</span><strong>{dims.heightFt.toFixed(1)} <small>ft</small></strong></div><div><span>Canopy · year {year}</span><strong>{dims.widthFt.toFixed(1)} <small>ft</small></strong></div></div>
      <div className="maturity"><span>Estimated maturity</span><strong>{Math.round(dims.maturity*100)}%</strong><div><i style={{width:`${dims.maturity*100}%`}}/></div></div>
      <details className="plant-notes"><summary>Plant & season notes</summary><h3>Seasonal character</h3><p>{species.seasons[season]}</p><h3>Light</h3><p>{species.sun}</p><h3>Soil</h3><p>{species.soil}</p><h3>Model note</h3><p>{species.note}</p>{plant.measurementSource&&<p>{plant.measurementSource}. Geometry, species, and present condition require field verification.</p>}</details>
      <div className="detail-actions"><button onClick={()=>duplicate(plant.id)}><Copy size={15}/>Duplicate</button><button className="danger" onClick={()=>remove(plant.id)}><Trash2 size={15}/>Delete</button></div>
    </div>
  </aside>
}
