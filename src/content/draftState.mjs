import { categoryLabel } from './categories.mjs'
export const validateDraftName = name => ({valid:typeof name === 'string' && !!name.trim(),message:typeof name === 'string' && name.trim() ? '' : '请填写条目名称后保存。'})
export const draftLabel = draft => `${draft.name?.trim() || `新${categoryLabel(draft.category)}`}${draft.saved && !draft.dirty ? '' : '（未保存）'}`
export function transitionDraft(state,{targetId,decision,replacement=false}) {
 const current=state.drafts[state.selected]
 if (current?.dirty && (targetId !== state.selected || replacement) && !decision) return {state,needsDecision:true}
 if (decision === 'cancel') return {state,needsDecision:false}
 let drafts=state.drafts
 if (decision === 'discard' && current) {
  drafts={...drafts}
  if (current.savedSnapshot) drafts[current.id]={...current.savedSnapshot,saved:true,dirty:false,savedSnapshot:current.savedSnapshot}
  else delete drafts[current.id]
 }
 return {state:{...state,drafts,selected:targetId},needsDecision:false}
}
