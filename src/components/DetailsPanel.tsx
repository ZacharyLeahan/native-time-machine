import { CircleCheck, CircleDashed, Copy, Leaf, MapPinned, Ruler, ScanLine, Sun, Trash2, Trees } from 'lucide-react'
import { catalogById } from '../data/catalog'
import { dimensionsForPlantAtYear } from '../simulation/growth'
import { usePlannerStore } from '../store/usePlannerStore'

export function DetailsPanel() {
  const design=usePlannerStore((s)=>s.design), selectedId=usePlannerStore((s)=>s.selectedPlantId), year=usePlannerStore((s)=>s.year), season=usePlannerStore((s)=>s.season)
  const remove=usePlannerStore((s)=>s.deletePlant), duplicate=usePlannerStore((s)=>s.duplicatePlant)
  const plant=design.plants.find((p)=>p.id===selectedId), species=plant?catalogById.get(plant.speciesId):undefined
  if(!plant||!species) return <aside className="details-panel panel site-overview">
    <div className="site-overview-hero"><span className="eyebrow">SITE WORKSPACE</span><h2>15 Pickwick Lane</h2><p>Mapped context is ready. Existing trunks remain intentionally unverified.</p></div>
    <div className="site-metrics"><div><MapPinned size={17}/><span>Parcel</span><strong>0.485 ac</strong></div><div><Trees size={17}/><span>Design plants</span><strong>{design.plants.length}</strong></div></div>
    <section className="survey-status"><div className="section-title"><ScanLine size={16}/><span>Existing-tree survey</span></div><div className="status-number"><strong>0</strong><span>verified trunks</span></div><ul><li className="done"><CircleCheck/>Parcel and house aligned</li><li className="done"><CircleCheck/>2024–25 LiDAR analyzed</li><li><CircleDashed/>Ground trunk measurements pending</li></ul></section>
    <section className="next-step"><Ruler size={18}/><div><strong>Next accuracy step</strong><p>Measure each trunk from two or three fixed house corners. Those measurements become the authoritative tree layer.</p></div></section>
    <p className="overview-hint">Select a design plant in the scene to inspect growth, position, and seasonal details.</p>
  </aside>
  const dims=dimensionsForPlantAtYear(species,plant,year)
  const sourceLabel=plant.origin==='existing-lidar'?`Existing · measured ${plant.measurementYear} LiDAR canopy`:plant.origin==='existing-inferred'?`Existing · ${plant.confidence??'low'}-confidence imagery estimate`:species.type
  return <aside className="details-panel panel">
    <div className="detail-hero" style={{background:`linear-gradient(135deg, ${species.palette[season]}, #233d2f)`}}><span>{sourceLabel}</span><h2>{species.commonName}</h2><em>{species.scientificName}</em></div>
    <div className="detail-body">
      <div className="now-grid"><div><Ruler size={16}/><span>Height at year {year}</span><strong>{dims.heightFt.toFixed(1)} ft</strong></div><div><Trees size={16}/><span>Canopy at year {year}</span><strong>{dims.widthFt.toFixed(1)} ft</strong></div></div>
      <div className="maturity"><span>Estimated maturity</span><strong>{Math.round(dims.maturity*100)}%</strong><div><i style={{width:`${dims.maturity*100}%`}}/></div></div>
      <section><h3>Seasonal character</h3><p>{species.seasons[season]}</p></section>
      <section className="preferences"><h3>Growing preferences</h3><p><Sun size={15}/><span><strong>Light</strong>{species.sun}</span></p><p><Leaf size={15}/><span><strong>Soil</strong>{species.soil}</span></p></section>
      <section className="assumption"><strong>Model note</strong><p>{species.note}</p></section>
      {plant.measurementSource&&<section className="assumption"><strong>Geometry source</strong><p>{plant.measurementSource}. Trunk centers, crown widths, and heights are imagery-based estimates; species and present-day condition require field verification.</p></section>}
      <div className="position-row"><span>Position</span><code>{plant.xFt.toFixed(1)}, {plant.zFt.toFixed(1)} ft</code></div>
      <div className="detail-actions"><button onClick={()=>duplicate(plant.id)}><Copy size={16}/> Duplicate</button><button className="danger" onClick={()=>remove(plant.id)}><Trash2 size={16}/> Delete</button></div>
    </div>
  </aside>
}
