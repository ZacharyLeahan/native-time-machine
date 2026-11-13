import { arrangeItems, type ArrangeAction } from './plantingGroup'
export type SelectionAction=ArrangeAction|'move'|'duplicate'|'inspect'|'delete'|'clear'
export interface SelectionWheelItem {label:string;action:SelectionAction;icon:string}
export function selectionWheelItems(count:number,editing=false):SelectionWheelItem[]{
  if(count===1)return [
    {label:'Move precisely',action:'move',icon:'✥'},
    {label:'Whole-foot setback',action:'snap',icon:'⌗'},
    {label:'Duplicate',action:'duplicate',icon:'+'},
    {label:'Plant details',action:'inspect',icon:'ⓘ'},
    {label:'Delete plant',action:'delete',icon:'−'},
    {label:editing?'Cancel move':'Clear selection',action:editing?'cancel':'clear',icon:'×'},
  ]
  return arrangeItems.map((item,index)=>({...item,icon:['≡','Ⅱ','↔','◯','⌗','×'][index],...(index===5&&!editing?{label:'Clear selection',action:'clear' as const}:{})}))
}
