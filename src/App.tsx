import { useEffect } from 'react'
import { CatalogPanel } from './components/CatalogPanel'
import { DetailsPanel } from './components/DetailsPanel'
import { PlannerCanvas } from './components/PlannerCanvas'
import { Timeline } from './components/Timeline'
import { Toolbar } from './components/Toolbar'
import { saveDesign } from './persistence/design'
import { usePlannerStore } from './store/usePlannerStore'

export default function App(){
  const design=usePlannerStore((s)=>s.design),notice=usePlannerStore((s)=>s.notice),clear=usePlannerStore((s)=>s.clearNotice)
  useEffect(()=>{const id=setTimeout(()=>saveDesign(design),350);return()=>clearTimeout(id)},[design])
  useEffect(()=>{if(!notice)return;const id=setTimeout(clear,2600);return()=>clearTimeout(id)},[notice,clear])
  return <div className="app-shell"><Toolbar/><main className="workspace"><CatalogPanel/><PlannerCanvas/><DetailsPanel/></main><Timeline/>{notice&&<div className="toast">{notice}</div>}</div>
}
