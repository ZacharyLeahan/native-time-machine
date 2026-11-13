import { equipmentForFavorites } from '../simulation/controller'
import { useEffect } from 'react'
import { usePlannerStore } from '../store/usePlannerStore'
import './EquipmentWheel.css'
import type { WalkAimRef } from './WalkControls'
import { selectionWheelItems } from '../simulation/selectionActions'

export function EquipmentWheel({aimRef}:{aimRef:WalkAimRef}){
  const open=usePlannerStore(s=>s.wheelOpen),selected=usePlannerStore(s=>s.wheelIndex)
  const favorites=usePlannerStore(s=>s.favorites)
  const arranging=usePlannerStore(s=>Boolean(s.walkArrangement||s.walkMarked.length))
  const count=usePlannerStore(s=>s.walkMarked.length),editing=usePlannerStore(s=>Boolean(s.walkArrangement))
  const equipmentItems=arranging?selectionWheelItems(count,editing).map(item=>({...item,speciesId:null})):equipmentForFavorites(favorites).map(item=>({...item,icon:item.speciesId?'✿':item.action==='move'?'✥':'×'}))
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
    <div className="wheel-center"><strong>{arranging?count===1?'Plant actions':'Align selection':'Plant kit'}</strong><span>RS chooses · release LB {arranging?'acts':'equips'}</span><small>{arranging?`${count} selected · B closes`:'B cancels · RT plants after equipping'}</small></div>
    {equipmentItems.map((item,index)=>{
      const angle=index*Math.PI/3
      return <button key={index} disabled={item.action==='empty'} className={`${selected===index?'selected':''} ${item.action==='delete'?'wheel-delete':''}`} style={{left:`${50+Math.sin(angle)*35}%`,top:`${50-Math.cos(angle)*35}%`}} aria-pressed={selected===index} onMouseEnter={()=>usePlannerStore.setState({wheelIndex:index})} onClick={()=>{const aim=aimRef.current;usePlannerStore.getState().chooseEquipment(index,aim.xFt,aim.zFt)}}><span>{item.icon}</span>{item.label}</button>
    })}
    <button className="wheel-cancel" onClick={()=>usePlannerStore.setState({wheelOpen:false,wheelIndex:null})}>Close wheel · Esc</button>
  </section>
}
