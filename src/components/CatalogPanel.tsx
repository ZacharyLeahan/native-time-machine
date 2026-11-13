import { Search, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { catalog } from '../data/catalog'
import { usePlannerStore } from '../store/usePlannerStore'

export function CatalogPanel() {
  const [query,setQuery]=useState(''),[tab,setTab]=useState<'all'|'kit'>('all')
  const armed=usePlannerStore(s=>s.armedSpeciesId),arm=usePlannerStore(s=>s.armSpecies),favorites=usePlannerStore(s=>s.favorites),toggleFavorite=usePlannerStore(s=>s.toggleFavorite)
  const visible=useMemo(()=>catalog.filter(p=>p.catalogVisible!==false),[])
  const collection=tab==='kit'?favorites.flatMap(id=>visible.filter(p=>p.id===id)):visible
  const items=collection.filter(p=>`${p.commonName} ${p.scientificName} ${p.type}`.toLowerCase().includes(query.toLowerCase()))
  return <aside className="catalog-panel panel" aria-label="Plant library">
    <div className="panel-heading"><div><span className="eyebrow">NATIVE COLLECTION</span><h2>Plant library</h2></div><span className="count">{visible.length}</span></div>
    <div className="catalog-tabs" role="group" aria-label="Plant collection"><button aria-pressed={tab==='all'} onClick={()=>setTab('all')}>All plants</button><button aria-pressed={tab==='kit'} onClick={()=>setTab('kit')}>Plant kit <span>{favorites.length}/4</span></button></div>
    <label className="search-box"><Search size={15}/><input aria-label="Search plants" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name or species"/></label>
    {tab==='kit'&&<p className="kit-help">Your wheel slots, in order. Hold LB in Walk to equip. Star plants to edit your kit.</p>}
    <div className="catalog-list">{items.map((plant,index)=><div className="catalog-entry" key={plant.id}><button className={`catalog-card ${armed===plant.id?'active':''}`} aria-pressed={armed===plant.id} onClick={()=>arm(armed===plant.id?null:plant.id)}><span className="plant-index"><i style={{background:plant.palette.summer}}/>{String(index+1).padStart(2,'0')}</span><span className="catalog-copy"><strong>{plant.commonName}</strong><em>{plant.scientificName}</em><small>{plant.type} · {plant.matureHeightFt[0]}–{plant.matureHeightFt[1]} ft</small></span></button><button className="favorite-toggle" aria-label={`${favorites.includes(plant.id)?'Remove':'Add'} ${plant.commonName} ${favorites.includes(plant.id)?'from':'to'} favorites`} aria-pressed={favorites.includes(plant.id)} onClick={()=>toggleFavorite(plant.id)}><Star size={15} fill={favorites.includes(plant.id)?'currentColor':'none'}/></button></div>)}</div>
    {!items.length&&<p className="kit-help">{query?'No matching plants.':'Star a plant in All plants to build your kit.'}</p>}
    <p className="library-footnote">{armed?'Click in the yard to place. Esc cancels.':'Select a species, then place it in the yard.'}</p>
  </aside>
}
