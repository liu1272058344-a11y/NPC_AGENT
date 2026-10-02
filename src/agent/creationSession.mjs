export const createWorldDraft = (idFactory = () => crypto.randomUUID()) => ({
  kind: 'world', id: idFactory(), value: null, saveState: 'unsaved', updatedAt: null
})

export const createCharacterDraft = (idFactory = () => crypto.randomUUID(), world = null) => ({
  kind: 'character', id: idFactory(), value: null, worldId: world?.id || '', worldSnapshot: world || null, saveState: 'unsaved', updatedAt: null
})

export const copyDraftAsNew = (draft, idFactory = () => crypto.randomUUID()) => ({
  ...draft, id: idFactory(), value: draft.value ? { ...draft.value } : null, saveState: 'unsaved', updatedAt: null
})

export const applyWorldResult = (session, world) => ({
  ...session,
  world: { ...session.world, value: { ...world, id: session.world.id }, saveState: session.world.saveState === 'unsaved' ? 'unsaved' : 'dirty' }
})

export const applyCharacterResult = (session, npc) => ({
  ...session,
  character: { ...session.character, value: { ...npc, id: session.character.id }, saveState: session.character.saveState === 'unsaved' ? 'unsaved' : 'dirty' }
})

export const markDraftSaved = (draft, updatedAt) => ({ ...draft, saveState: 'saved', updatedAt })

export const switchCreationKind = (session, activeKind) => ({ ...session, activeKind })
