import { ChevronDown, ChevronUp, ExternalLink, Pause, Play, RotateCcw, Sun, Sunrise, Sunset } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import type { SolarSnapshot } from '../simulation/solar'
import { formatClockMinute } from '../simulation/solar'

interface Props {
  date: string
  minute: number
  playing: boolean
  speed: number
  snapshot: SolarSnapshot
  onDateChange: (date: string) => void
  onMinuteChange: (minute: number) => void
  onPlayingChange: (playing: boolean) => void
  onSpeedChange: (speed: number) => void
  onToday: () => void
}

export function SunPanel({date,minute,playing,speed,snapshot,onDateChange,onMinuteChange,onPlayingChange,onSpeedChange,onToday}:Props) {
  const [expanded,setExpanded]=useState(false)
  const roofStatus=snapshot.isAboveHorizon?'Sun above horizon · inspect roof shadows':'Sun below horizon'
  return <section className={`sun-console ${expanded?'expanded':'collapsed'}`} aria-label="Solar day simulator">
    <div className="sun-console-heading">
      <span className={`sun-orb ${snapshot.isAboveHorizon?'day':'night'}`}><Sun size={17}/></span>
      <div><span className="eyebrow">Solar day · Malvern</span><strong>{formatClockMinute(minute)}</strong></div>
      <div className="sun-heading-actions">
        {!expanded&&<button className="sun-mini-play" onClick={()=>onPlayingChange(!playing)} aria-label={playing?'Pause solar day':'Play solar day'}>{playing?<Pause size={15}/>:<Play size={15} fill="currentColor"/>}</button>}
        <button className="sun-collapse" onClick={()=>setExpanded((value)=>!value)} aria-expanded={expanded} aria-label={expanded?'Minimize solar controls':'Expand solar controls'}>{expanded?<ChevronDown size={17}/>:<ChevronUp size={17}/>}</button>
      </div>
    </div>
    {expanded&&<>
      <div className="sun-date-row">
        <input aria-label="Solar simulation date" type="date" value={date} onChange={(event)=>onDateChange(event.target.value)}/>
        <button className="sun-today" onClick={onToday} title="Return to the July baseline"><RotateCcw size={12}/> July 15 baseline</button>
        <span>UTC{snapshot.timezoneOffsetHours >= 0?'+':''}{snapshot.timezoneOffsetHours}</span>
      </div>
      <div className="sun-playback">
        <button className="sun-play" onClick={()=>onPlayingChange(!playing)} aria-label={playing?'Pause solar day':'Play solar day'}>{playing?<Pause size={17}/>:<Play size={17} fill="currentColor"/>}</button>
        <div className="sun-scrubber"><input aria-label="Time of day" type="range" min="0" max="1439" step="1" value={Math.round(minute)} onChange={(event)=>onMinuteChange(Number(event.target.value))} style={{'--sun-progress':`${minute/1439*100}%`} as CSSProperties}/><span><i>12 AM</i><i>Solar time</i><i>12 AM</i></span></div>
        <label className="sun-speed"><span>Speed</span><select value={speed} onChange={(event)=>onSpeedChange(Number(event.target.value))}><option value="1">1×</option><option value="5">5×</option><option value="15">15×</option></select></label>
      </div>
      <div className="sun-events">
        <span><Sunrise size={14}/><small>Sunrise</small><strong>{formatClockMinute(snapshot.sunriseMinutes)}</strong></span>
        <span><Sun size={14}/><small>Solar noon</small><strong>{formatClockMinute(snapshot.solarNoonMinutes)}</strong></span>
        <span><Sunset size={14}/><small>Sunset</small><strong>{formatClockMinute(snapshot.sunsetMinutes)}</strong></span>
      </div>
      <div className="sun-readout">
        <div><span>Direction</span><strong>{snapshot.azimuthDeg.toFixed(1)}° azimuth</strong></div>
        <div><span>Height</span><strong>{snapshot.altitudeDeg.toFixed(1)}° elevation</strong></div>
        <div className={snapshot.isAboveHorizon?'lit':'dark'}><span>Modeled roof</span><strong>{roofStatus}</strong></div>
      </div>
      <details className="sun-accuracy">
        <summary>What is accurate here?</summary>
        <p><b>Sun position:</b> NREL SPA astronomy at 40.028618° N, 75.531244° W, LiDAR ground elevation, 992 hPa, and 15°C, corrected for State Plane grid north.</p>
        <p><b>Shadows:</b> Solar ground shows shade over LiDAR terrain and a roof fitted to 2024–25 returns. Small roof details, overhangs, neighboring structures and existing trees remain unverified. This is an improved planning model, not a surveyed shade assessment.</p>
        <a href="https://midcdmz.nlr.gov/spa/" target="_blank" rel="noreferrer">NREL Solar Position Algorithm <ExternalLink size={11}/></a>
      </details>
    </>}
  </section>
}
