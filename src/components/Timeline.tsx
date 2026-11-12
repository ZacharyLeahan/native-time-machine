import { Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePlannerStore } from '../store/usePlannerStore'

export function Timeline(){
  const year=usePlannerStore((s)=>s.year),setYear=usePlannerStore((s)=>s.setYear);const[playing,setPlaying]=useState(false)
  useEffect(()=>{if(!playing)return;const id=window.setInterval(()=>setYear(year>=50?0:year+1),180);return()=>clearInterval(id)},[playing,year,setYear])
  return <footer className="timeline"><button className="play" aria-label={playing?'Pause growth timeline':'Play growth timeline'} title={playing?'Pause plant growth':'Play plant growth'} onClick={()=>setPlaying((p)=>!p)}>{playing?<Pause size={18}/>:<Play size={18}/>}</button><div className="year-readout"><span>GROWTH</span><strong>Year {year}</strong></div><div className="slider-wrap"><input aria-label="Simulation year" type="range" min="0" max="50" value={year} onChange={(e)=>{setPlaying(false);setYear(Number(e.target.value))}} style={{'--progress':`${year*2}%`} as React.CSSProperties}/><div className="ticks"><span>Today</span><span>10 years</span><span>25 years</span><span>50 years</span></div></div><p><strong>Growth timeline</strong><br/>Drag or play to watch the planted design mature.</p></footer>
}
