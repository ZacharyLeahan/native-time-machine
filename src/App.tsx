import { useEffect, useState } from 'react'
import { PlantingSummary } from './components/PlantingSummary'
import './components/PlannerEnhancements.css'
import { CatalogPanel } from './components/CatalogPanel'
import { DetailsPanel } from './components/DetailsPanel'
import { PlannerCanvas } from './components/PlannerCanvas'
import { Timeline } from './components/Timeline'
import { Toolbar } from './components/Toolbar'
import { usePlannerStore } from './store/usePlannerStore'

export default function App(){
  const [summaryOpen,setSummaryOpen]=useState(false)
  const design=usePlannerStore((s)=>s.design),notice=usePlannerStore((s)=>s.notice),clear=usePlannerStore((s)=>s.clearNotice),viewMode=usePlannerStore((s)=>s.viewMode)
  useEffect(()=>{const id=setTimeout(()=>usePlannerStore.getState().autosave(),350);return()=>clearTimeout(id)},[design])
  useEffect(()=>{
    const shortcut=(event:KeyboardEvent)=>{
      if(event.target instanceof HTMLElement && (event.target.closest('dialog[open],input,textarea,select')||event.target.isContentEditable))return
      if(event.key==='Escape'){
        const state=usePlannerStore.getState()
        if(state.viewMode==='garden'||state.viewMode==='planner'){state.armSpecies(null);state.selectPlant(null)}
        return
      }
      if(!(event.ctrlKey||event.metaKey))return
      if(event.key.toLowerCase()==='z'){event.preventDefault();usePlannerStore.getState()[event.shiftKey?'redo':'undo']()}
      if(event.key.toLowerCase()==='y'){event.preventDefault();usePlannerStore.getState().redo()}
    }
    window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut)
  },[])
  useEffect(()=>{if(!notice)return;const id=setTimeout(clear,2600);return()=>clearTimeout(id)},[notice,clear])
  return <div className={`app-shell studio-shell ${(viewMode==='walk'||viewMode==='spectator')?'walk-active':''}`}><Toolbar onSummary={()=>setSummaryOpen(true)}/><main className={`workspace ${(viewMode==='walk'||viewMode==='spectator')?'walk-mode':''}`}><CatalogPanel/><PlannerCanvas/><DetailsPanel/></main><Timeline/>{notice&&<div className="toast" role="status">{notice}</div>}{summaryOpen&&<PlantingSummary onClose={()=>setSummaryOpen(false)}/>}</div>
}
