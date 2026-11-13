import { equipmentForFavorites } from '../simulation/controller'
import { usePlannerStore } from '../store/usePlannerStore'
import './EquipmentWheel.css'

export function EquipmentWheel(){
  const open=usePlannerStore(s=>s.wheelOpen),selected=usePlannerStore(s=>s.wheelIndex)
  const favorites=usePlannerStore(s=>s.favorites)
  const equipmentItems=equipmentForFavorites(favorites)
  if(!open)return null
  return <section className="equipment-wheel" role="dialog" aria-label="Plant equipment wheel" aria-modal="false">
    <div className="wheel-center"><strong>Plant kit</strong><span>RS selects · release LB equips</span><small>B cancels · RT plants after equipping</small></div>
    {equipmentItems.map((item,index)=>{
      const angle=index*Math.PI/3
      return <button key={index} disabled={item.action==='empty'} className={selected===index?'selected':''} style={{left:`${50+Math.sin(angle)*35}%`,top:`${50-Math.cos(angle)*35}%`}} aria-pressed={selected===index} onMouseEnter={()=>usePlannerStore.setState({wheelIndex:index})} onClick={()=>usePlannerStore.getState().chooseEquipment(index,0,-85)}><span>{item.speciesId?'✿':index===4?'✥':'×'}</span>{item.label}</button>
    })}
    <button className="wheel-cancel" onClick={()=>usePlannerStore.setState({wheelOpen:false,wheelIndex:null})}>Close wheel</button>
  </section>
}
