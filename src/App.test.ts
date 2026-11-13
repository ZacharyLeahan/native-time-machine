import { afterEach,describe,expect,it,vi } from 'vitest'
import { defaultDesign } from './persistence/design'
import { usePlannerStore as store } from './store/usePlannerStore'
import App from './App'

const harness=vi.hoisted(()=>({cleanups:[] as (()=>void)[]}))
vi.mock('react',async original=>({...(await original<typeof import('react')>()),useState:()=>[false,()=>{}],useEffect:(effect:()=>void|(()=>void))=>{const cleanup=effect();if(cleanup)harness.cleanups.push(cleanup)}}))
vi.mock('./store/usePlannerStore',async original=>{
  const {usePlannerStore:actual}=await original<typeof import('./store/usePlannerStore')>()
  return {usePlannerStore:Object.assign((select:(state:ReturnType<typeof actual.getState>)=>unknown)=>select(actual.getState()),{getState:actual.getState,setState:actual.setState})}
})
afterEach(()=>{harness.cleanups.splice(0).forEach(cleanup=>cleanup());vi.unstubAllGlobals()})
describe('summary keyboard isolation',()=>{
  it('does not undo the design behind the summary or a text field, while normal undo/redo still work',()=>{
    store.setState({design:{...defaultDesign,plants:[]},viewMode:'garden',past:[],future:[],moveBaseline:null,notice:null})
    store.getState().placePlant('white-oak',0,0)
    const original=store.getState().design,empty=store.getState().past[0]
    let keydown:(event:KeyboardEvent)=>void=()=>{}
    vi.stubGlobal('window',{addEventListener:(type:string,handler:typeof keydown)=>{if(type==='keydown')keydown=handler},removeEventListener:()=>{}})
    class ElementStub {isContentEditable=false;constructor(private blocked:boolean){}closest(){return this.blocked?this:null}}
    vi.stubGlobal('HTMLElement',ElementStub)
    App()
    const event=(blocked:boolean,key='z',shiftKey=false)=>({key,shiftKey,ctrlKey:true,metaKey:false,target:new ElementStub(blocked),preventDefault:vi.fn()}) as unknown as KeyboardEvent
    keydown(event(true));expect(store.getState().design).toBe(original)
    keydown(event(false));expect(store.getState().design).toBe(empty)
    keydown(event(false,'z',true));expect(store.getState().design).toBe(original)
    keydown(event(false));keydown(event(false,'y'));expect(store.getState().design).toBe(original)
  })
})
