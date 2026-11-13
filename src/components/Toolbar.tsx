import { Box, Download, Focus, Grid3X3, Leaf, PersonStanding, RotateCcw, Save, Upload, Undo2, Redo2, Video } from 'lucide-react'
import { useRef } from 'react'
import { serializeDesign } from '../persistence/design'
import { usePlannerStore } from '../store/usePlannerStore'
import type { Season } from '../types'

const seasons: {id:Season;label:string;symbol:string}[]=[{id:'spring',label:'Spring',symbol:'✿'},{id:'summer',label:'Summer',symbol:'●'},{id:'fall',label:'Fall',symbol:'◆'},{id:'winter',label:'Winter',symbol:'❄'}]

export function Toolbar() {
  const season=usePlannerStore((s)=>s.season),setSeason=usePlannerStore((s)=>s.setSeason),viewMode=usePlannerStore((s)=>s.viewMode),setViewMode=usePlannerStore((s)=>s.setViewMode),persist=usePlannerStore((s)=>s.persist),resetCamera=usePlannerStore((s)=>s.resetCamera),resetDesign=usePlannerStore((s)=>s.resetDesign),design=usePlannerStore((s)=>s.design),importDesign=usePlannerStore((s)=>s.importDesign)
  const readOnly=viewMode==='spectator'
  const fileRef=useRef<HTMLInputElement>(null)
  const canUndo=usePlannerStore(s=>s.past.length>0),canRedo=usePlannerStore(s=>s.future.length>0),saveStatus=usePlannerStore(s=>s.saveStatus)
  function download(){const blob=new Blob([serializeDesign(design)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='landscape-design.json';a.click();URL.revokeObjectURL(url)}
  async function upload(file?:File){if(!file)return;try{importDesign(await file.text())}catch(error){alert(error instanceof Error?error.message:'Could not import design.')}finally{if(fileRef.current)fileRef.current.value=''}}
  return <header className="toolbar">
    <div className="brand"><span className="brand-mark"><Leaf/></span><span><strong>Native</strong><em>TIME MACHINE</em></span></div>
    <nav className="seasons" aria-label="Season">{seasons.map((s)=><button key={s.id} className={season===s.id?'active':''} onClick={()=>setSeason(s.id)}><span>{s.symbol}</span>{s.label}</button>)}</nav>
    <div className="history-controls"><button aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" disabled={readOnly||!canUndo} onClick={()=>usePlannerStore.getState().undo()}><Undo2 size={17}/></button><button aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" disabled={readOnly||!canRedo} onClick={()=>usePlannerStore.getState().redo()}><Redo2 size={17}/></button><small role="status">{saveStatus}</small></div>
    <div className="toolbar-actions"><div className="view-switch"><button className={viewMode==='garden'?'active':''} title="3D garden view" onClick={()=>setViewMode('garden')}><Box size={17}/><span>3D Garden</span></button><button className={viewMode==='planner'?'active':''} title="Overhead planner" onClick={()=>setViewMode('planner')}><Grid3X3 size={17}/><span>Plan</span></button><button className={viewMode==='walk'?'active':''} title="Walk through the landscape" onClick={()=>setViewMode('walk')}><PersonStanding size={17}/><span>Walk</span></button><button className={viewMode==='spectator'?'active':''} title="Fly freely without editing" onClick={()=>setViewMode('spectator')}><Video size={17}/><span>Spectator</span></button></div><button title="Reset camera" aria-label="Reset camera" onClick={resetCamera}><Focus size={18}/><span>Reset view</span></button><button title="Save locally" aria-label="Save locally" onClick={persist}><Save size={18}/><span>Save</span></button><button title="Import design JSON" aria-label="Import design JSON" disabled={readOnly} onClick={()=>fileRef.current?.click()}><Upload size={18}/><span className="secondary-action-label">Import</span></button><button title="Export design JSON" aria-label="Export design JSON" onClick={download}><Download size={18}/><span className="secondary-action-label">Export</span></button><button className="reset" title="Reset design" aria-label="Reset design" disabled={readOnly} onClick={()=>confirm('Reset the entire design?')&&resetDesign()}><RotateCcw size={18}/><span className="secondary-action-label">Reset</span></button><input ref={fileRef} hidden type="file" accept="application/json" onChange={(e)=>upload(e.target.files?.[0])}/></div>
  </header>
}
