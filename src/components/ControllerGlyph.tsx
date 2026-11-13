export function ControllerGlyph({button}:{button:'view'|'menu'}){
  return <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">{button==='view'?<><path d="M7 6V3H3v10h3"/><rect x="7" y="6" width="10" height="11" rx=".7"/></>:<path d="M3 5h14M3 10h14M3 15h14"/>}</svg>
}
