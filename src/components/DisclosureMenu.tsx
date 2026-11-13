import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export function DisclosureMenu({label, children}:{label:string;children:ReactNode}) {
  const ref=useRef<HTMLDetailsElement>(null)
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!ref.current?.contains(event.target)&&ref.current)ref.current.open=false}
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&ref.current?.open){ref.current.open=false;ref.current.querySelector('summary')?.focus();event.stopPropagation()}}
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape)
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}
  },[])
  return <details className="disclosure-menu" name="workspace-menus" ref={ref} onClick={event=>{if(event.target instanceof Element&&event.target.closest('[data-close-menu]')&&ref.current){ref.current.open=false;ref.current.querySelector('summary')?.focus()}}}><summary>{label}<ChevronDown size={13}/></summary><div className="disclosure-content">{children}</div></details>
}
