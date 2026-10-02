export const worldArchivePayload = (draft) => ({ id:draft.id,name:draft.value.name,profile:{...draft.value,id:draft.id} })

export const characterArchivePayload = (draft) => ({
  archive:{ id:draft.id,name:draft.value.name,summary:draft.value.summary || '',profile:{...draft.value,id:draft.id,category:'character',worldId:draft.worldId || '',world:draft.worldSnapshot || null} },
  prompts:[]
})

export const generationFailed = session => session

export const shouldConfirmLeave = draft => draft?.saveState === 'dirty' || (draft?.saveState === 'unsaved' && Boolean(draft?.value))
