import { Box, Download, Grid3X3, PersonStanding, RotateCcw, Save, Upload, Undo2, Redo2, Video } from 'lucide-react'
import { useRef } from 'react'
import { serializeDesign } from '../persistence/design'
import { usePlannerStore } from '../store/usePlannerStore'
import { DisclosureMenu } from './DisclosureMenu'
import type { Season } from '../types'

export function Toolbar({onSummary}:{onSummary:()=>void}) {
  const season=usePlannerStore(s=>s.season),setSeason=usePlannerStore(s=>s.setSeason),viewMode=usePlannerStore(s=>s.viewMode),setViewMode=usePlannerStore(s=>s.setViewMode),design=usePlannerStore(s=>s.design)
  const canUndo=usePlannerStore(s=>s.past.length>0),canRedo=usePlannerStore(s=>s.future.length>0),saveStatus=usePlannerStore(s=>s.saveStatus)
  const fileRef=useRef<HTMLInputElement>(null),readOnly=viewMode==='spectator'
  function download(){const blob=new Blob([serializeDesign(design)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='landscape-design.json';a.click();URL.revokeObjectURL(url)}
  async function upload(file?:File){if(!file)return;try{usePlannerStore.getState().importDesign(await file.text())}catch(error){alert(error instanceof Error?error.message:'Could not import design.')}finally{if(fileRef.current)fileRef.current.value=''}}
  return <header className="toolbar">
    <div className="brand"><svg className="brand-mark" viewBox="0 0 36 36" aria-hidden="true"><path d="M18 1v5m0 24v5M1 18h5m24 0h5M18 6C9 5 5 11 6 19c1 9 7 12 14 11 8-1 11-7 10-14C29 8 25 6 18 6Z"/><path d="M18 11c-5-1-8 3-7 8s4 7 9 6 7-5 5-10c-1-3-4-4-7-4Z"/><circle cx="18" cy="18" r="2.2"/></svg><div className="brand-name"><strong>Native</strong><span>TIME MACHINE</span></div></div>
    <nav className="view-switch" aria-label="View">{([{id:'garden',label:'Garden',Icon:Box},{id:'planner',label:'Plan',Icon:Grid3X3},{id:'walk',label:'Walk',Icon:PersonStanding},{id:'spectator',label:'Spectator',Icon:Video}] as const).map(({id,label,Icon})=><button key={id} className={viewMode===id?'active':''} aria-pressed={viewMode===id} onClick={()=>setViewMode(id)}><Icon size={15}/><span>{label}</span></button>)}</nav>
    <div className="history-controls"><button aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" disabled={readOnly||!canUndo} onClick={()=>usePlannerStore.getState().undo()}><Undo2 size={16}/></button><button aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" disabled={readOnly||!canRedo} onClick={()=>usePlannerStore.getState().redo()}><Redo2 size={16}/></button></div>
    <button className="summary-toggle" onClick={onSummary} disabled={viewMode==='walk'||readOnly}>Summary</button>
    <label className="season-select"><span>Season</span><select aria-label="Season" value={season} onChange={event=>setSeason(event.target.value as Season)}>{['spring','summer','fall','winter'].map(value=><option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></label>
    <DisclosureMenu label="Project"><p className="project-save-state" role="status">{saveStatus}</p><button data-close-menu aria-label="Save locally" onClick={()=>usePlannerStore.getState().persist()}><Save size={15}/>Save locally</button><button data-close-menu aria-label="Export design JSON" onClick={download}><Download size={15}/>Export design</button><button data-close-menu aria-label="Import design JSON" disabled={readOnly} onClick={()=>fileRef.current?.click()}><Upload size={15}/>Import design</button><button data-close-menu className="danger" aria-label="Reset design" disabled={readOnly} onClick={()=>confirm('Reset the entire design?')&&usePlannerStore.getState().resetDesign()}><RotateCcw size={15}/>Reset design</button></DisclosureMenu>
    <input ref={fileRef} hidden type="file" accept="application/json" onChange={event=>upload(event.target.files?.[0])}/>
  </header>
}
