export const worldArchivePayload = (draft) => ({ id:draft.id,name:draft.value.name,profile:{...draft.value,id:draft.id} })

export const characterArchivePayload = (draft) => ({
  archive:{ id:draft.id,name:draft.value.name,summary:draft.value.summary || '',profile:{...draft.value,id:draft.id,category:'character',worldId:draft.worldId || '',world:draft.worldSnapshot || null} },
  prompts:[]
})

export const generationFailed = session => session

export const shouldConfirmLeave = draft => draft?.saveState === 'dirty' || (draft?.saveState === 'unsaved' && Boolean(draft?.value))

const saveStateKey='npc-forge-creation-save-states'
const defaults={world:'saved',character:'saved'}
const valid=value=>value==='unsaved'||value==='saved'||value==='dirty'
export const readCreationSaveStates=storage=>{try{const value=JSON.parse(storage.getItem(saveStateKey)||'null');return value&&valid(value.world)&&valid(value.character)?value:{...defaults}}catch{return {...defaults}}}
export const writeCreationSaveStates=(storage,states)=>storage.setItem(saveStateKey,JSON.stringify(states))
export const hasUnsavedCreationDraft=(states,world,npc)=>Boolean((world&&states.world!=='saved')||(npc&&states.character!=='saved'))
const characterWorldContextKey='npc-forge-character-world-context'
export const readCharacterWorldContext=storage=>{try{const value=JSON.parse(storage.getItem(characterWorldContextKey)||'null');return value&&typeof value.worldId==='string'?{worldId:value.worldId,worldSnapshot:value.worldSnapshot&&typeof value.worldSnapshot==='object'?value.worldSnapshot:null}:{worldId:'',worldSnapshot:null}}catch{return {worldId:'',worldSnapshot:null}}}
export const writeCharacterWorldContext=(storage,context)=>storage.setItem(characterWorldContextKey,JSON.stringify({worldId:context.worldId||'',worldSnapshot:context.worldSnapshot||null}))
