import type { NPC } from '../types/npc'

const textFields: Array<[keyof NPC,string,boolean]> = [['name','角色名称',false],['role','角色身份',false],['world','所在世界',false],['function','游戏功能',false],['summary','角色概述',true],['goal','核心目标',true],['speechStyle','说话风格',true],['background','角色背景',true],['sourcePrompt','原始需求',true]]
const listValue=(values:string[])=>values.join('\n')
const readList=(value:string)=>value.split(/\r?\n/).map(item=>item.trim()).filter(Boolean)

export function CharacterFieldsEditor({ value, disabled, onChange }: { value:NPC;disabled?:boolean;onChange:(value:NPC)=>void }) {
  return <div className="creation-fields">{textFields.map(([key,label,multiline])=><label key={key}>{label}{multiline?<textarea disabled={disabled} value={String(value[key]||'')} onChange={event=>onChange({...value,[key]:event.target.value})}/>:<input disabled={disabled} value={String(value[key]||'')} onChange={event=>onChange({...value,[key]:event.target.value})}/>}</label>)}<label>性格（每行一项）<textarea disabled={disabled} value={listValue(value.personality)} onChange={event=>onChange({...value,personality:readList(event.target.value)})}/></label><label>行为规则（每行一项）<textarea disabled={disabled} value={listValue(value.behaviorRules)} onChange={event=>onChange({...value,behaviorRules:readList(event.target.value)})}/></label></div>
}
