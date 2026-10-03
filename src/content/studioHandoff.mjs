export function createStudioHandoff(input,idFactory=()=>crypto.randomUUID()) {
 if(typeof input.prompt!=='string'||!input.prompt.trim())throw new Error('请先生成或填写视觉提示词。')
 return {id:idFactory(),prompt:input.prompt,negativePrompt:input.negativePrompt||'',source:input.source||null,target:input.target||null,mode:input.mode||'generated'}
}
export function receiveStudioHandoff(state,incoming,decision) {
 if(!incoming || state.consumedId===incoming.id)return {state,needsDecision:false}
 if(decision==='cancel')return {state:{...state,consumedId:incoming.id,pending:null},needsDecision:false}
 if((state.dirty||state.hasUnsavedImage)&&decision!=='replace')return {state:{...state,pending:incoming},needsDecision:true}
 return {state:{...state,...incoming,consumedId:incoming.id,pending:null,dirty:false,hasUnsavedImage:false},needsDecision:false}
}
