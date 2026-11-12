import { Search, Sprout } from 'lucide-react'
import { useMemo, useState } from 'react'
import { catalog } from '../data/catalog'
import { usePlannerStore } from '../store/usePlannerStore'

export function CatalogPanel() {
  const [query,setQuery]=useState('')
  const armed=usePlannerStore((s)=>s.armedSpeciesId)
  const arm=usePlannerStore((s)=>s.armSpecies)
  const visibleCatalog=useMemo(()=>catalog.filter((p)=>p.catalogVisible!==false),[])
  const items=useMemo(()=>visibleCatalog.filter((p)=>`${p.commonName} ${p.scientificName} ${p.type}`.toLowerCase().includes(query.toLowerCase())),[query,visibleCatalog])
  return <aside className="catalog-panel panel">
    <div className="panel-heading"><div><span className="eyebrow">Plant library</span><h2>Choose a native</h2></div><span className="count">{visibleCatalog.length}</span></div>
    <label className="search-box"><Search size={16}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search plants…" /></label>
    <p className="panel-help">Select a species, then click in the yard.</p>
    <div className="catalog-list">
      {items.map((plant)=><button className={`catalog-card ${armed===plant.id?'active':''}`} key={plant.id} onClick={()=>arm(armed===plant.id?null:plant.id)}>
        <span className="plant-swatch" style={{background:plant.palette.summer}}><Sprout size={17}/></span>
        <span className="catalog-copy"><strong>{plant.commonName}</strong><em>{plant.scientificName}</em><small>{plant.type} · {plant.matureHeightFt[0]}–{plant.matureHeightFt[1]} ft</small></span>
        <span className="add-mark">{armed===plant.id?'✓':'+'}</span>
      </button>)}
    </div>
  </aside>
}
