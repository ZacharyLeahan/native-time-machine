import { equipmentForFavorites } from '../simulation/controller'
import { useEffect } from 'react'
import { usePlannerStore } from '../store/usePlannerStore'
import './EquipmentWheel.css'
import type { WalkAimRef } from './WalkControls'

export function EquipmentWheel({aimRef}:{aimRef:WalkAimRef}){
  const open=usePlannerStore(s=>s.wheelOpen),selected=usePlannerStore(s=>s.wheelIndex)
  const favorites=usePlannerStore(s=>s.favorites)
  const equipmentItems=equipmentForFavorites(favorites)
  useEffect(()=>{
    if(!open)return
    const dismiss=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return
      event.preventDefault()
      usePlannerStore.setState({wheelOpen:false,wheelIndex:null})
    }
    window.addEventListener('keydown',dismiss)
    return()=>window.removeEventListener('keydown',dismiss)
  },[open])
  if(!open)return null
  return <section className="equipment-wheel" role="dialog" aria-label="Plant equipment wheel" aria-modal="false">
    <div className="wheel-center"><strong>Plant kit</strong><span>RS selects · release LB equips</span><small>B cancels · RT plants after equipping</small></div>
    {equipmentItems.map((item,index)=>{
      const angle=index*Math.PI/3
      return <button key={index} disabled={item.action==='empty'} className={selected===index?'selected':''} style={{left:`${50+Math.sin(angle)*35}%`,top:`${50-Math.cos(angle)*35}%`}} aria-pressed={selected===index} onMouseEnter={()=>usePlannerStore.setState({wheelIndex:index})} onClick={()=>{const aim=aimRef.current;usePlannerStore.getState().chooseEquipment(index,aim.xFt,aim.zFt)}}><span>{item.speciesId?'✿':index===4?'✥':'×'}</span>{item.label}</button>
    })}
    <button className="wheel-cancel" onClick={()=>usePlannerStore.setState({wheelOpen:false,wheelIndex:null})}>Close wheel · Esc</button>
  </section>
}
