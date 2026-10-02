import type { WorldProfile } from '../types/npc'

const fields: Array<[keyof WorldProfile,string]> = [['name','世界名称'],['genre','游戏类型'],['era','时代背景'],['atmosphere','整体氛围'],['coreRule','核心规则'],['centralConflict','主要冲突'],['summary','世界概述']]

export function WorldFieldsEditor({ value, disabled, onChange }: { value:WorldProfile;disabled?:boolean;onChange:(value:WorldProfile)=>void }) {
  return <div className="creation-fields">{fields.map(([key,label])=><label key={key}>{label}{key==='summary'||key==='centralConflict'?<textarea disabled={disabled} value={String(value[key]||'')} onChange={event=>onChange({...value,[key]:event.target.value})}/>:<input disabled={disabled} value={String(value[key]||'')} onChange={event=>onChange({...value,[key]:event.target.value})}/>}</label>)}</div>
}
