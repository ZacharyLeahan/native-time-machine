import { useEffect } from 'react'
import { CatalogPanel } from './components/CatalogPanel'
import { DetailsPanel } from './components/DetailsPanel'
import { PlannerCanvas } from './components/PlannerCanvas'
import { Timeline } from './components/Timeline'
import { Toolbar } from './components/Toolbar'
import { usePlannerStore } from './store/usePlannerStore'

export default function App(){
  const design=usePlannerStore((s)=>s.design),notice=usePlannerStore((s)=>s.notice),clear=usePlannerStore((s)=>s.clearNotice),viewMode=usePlannerStore((s)=>s.viewMode)
  useEffect(()=>{const id=setTimeout(()=>usePlannerStore.getState().autosave(),350);return()=>clearTimeout(id)},[design])
  useEffect(()=>{
    const shortcut=(event:KeyboardEvent)=>{
      if(event.target instanceof HTMLElement && (event.target.matches('input,textarea,select')||event.target.isContentEditable))return
      if(!(event.ctrlKey||event.metaKey))return
      if(event.key.toLowerCase()==='z'){event.preventDefault();usePlannerStore.getState()[event.shiftKey?'redo':'undo']()}
      if(event.key.toLowerCase()==='y'){event.preventDefault();usePlannerStore.getState().redo()}
    }
    window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut)
  },[])
  useEffect(()=>{if(!notice)return;const id=setTimeout(clear,2600);return()=>clearTimeout(id)},[notice,clear])
  return <div className={`app-shell ${viewMode==='walk'?'walk-active':''}`}><Toolbar/><main className={`workspace ${viewMode==='walk'?'walk-mode':''}`}><CatalogPanel/><PlannerCanvas/><DetailsPanel/></main><Timeline/>{notice&&<div className="toast" role="status">{notice}</div>}</div>
}
