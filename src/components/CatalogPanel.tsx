import { Search, Sprout, Star, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { catalog } from '../data/catalog'
import { usePlannerStore } from '../store/usePlannerStore'

export function CatalogPanel() {
  const [query,setQuery]=useState('')
  const armed=usePlannerStore((s)=>s.armedSpeciesId)
  const arm=usePlannerStore((s)=>s.armSpecies)
  const favorites=usePlannerStore(s=>s.favorites),toggleFavorite=usePlannerStore(s=>s.toggleFavorite)
  const visibleCatalog=useMemo(()=>catalog.filter((p)=>p.catalogVisible!==false),[])
  const items=useMemo(()=>visibleCatalog.filter((p)=>`${p.commonName} ${p.scientificName} ${p.type}`.toLowerCase().includes(query.toLowerCase())),[query,visibleCatalog])
  return <aside className="catalog-panel panel">
    <div className="panel-heading"><div><span className="eyebrow">Plant library</span><h2>Choose a native</h2></div><span className="count">{visibleCatalog.length}</span></div>
    <label className="search-box"><Search size={16}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search plants…" /></label>
    <p className="panel-help">Select a species, then click in the yard.</p>
    <section className="favorites-tray" aria-label="Favorite plant kit">
      <div><strong>Plant kit</strong><span>{favorites.length}/4 · Xbox LB wheel</span></div>
      <p>Star up to four plants for quick access.</p>
      {favorites.length===0&&<p>Your kit is empty. Star a plant below.</p>}
      {favorites.map((id,index)=>{const species=visibleCatalog.find(p=>p.id===id);return species&&<div className="favorite-item" key={id}><button aria-pressed={armed===id} onClick={()=>arm(armed===id?null:id)}><small>{index+1}</small>{species.commonName}</button><button aria-label={`Remove ${species.commonName} from favorites`} onClick={()=>toggleFavorite(id)}><X size={13}/></button></div>})}
    </section>
    <div className="catalog-list">
      {items.map((plant)=><div className="catalog-entry" key={plant.id}><button className={`catalog-card ${armed===plant.id?'active':''}`} onClick={()=>arm(armed===plant.id?null:plant.id)}>
        <span className="plant-swatch" style={{background:plant.palette.summer}}><Sprout size={17}/></span>
        <span className="catalog-copy"><strong>{plant.commonName}</strong><em>{plant.scientificName}</em><small>{plant.type} · {plant.matureHeightFt[0]}–{plant.matureHeightFt[1]} ft</small></span>
        <span className="add-mark">{armed===plant.id?'✓':'+'}</span>
      </button><button className="favorite-toggle" aria-label={`${favorites.includes(plant.id)?'Remove':'Add'} ${plant.commonName} ${favorites.includes(plant.id)?'from':'to'} favorites`} aria-pressed={favorites.includes(plant.id)} onClick={()=>toggleFavorite(plant.id)}><Star size={16} fill={favorites.includes(plant.id)?'currentColor':'none'}/></button></div>)}
    </div>
  </aside>
}
