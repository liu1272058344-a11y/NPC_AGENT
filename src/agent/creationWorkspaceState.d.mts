import type { CharacterDraft, CreationSession, WorldDraft } from './creationSession.mjs'
export function worldArchivePayload(draft:WorldDraft):{id:string;name:string;profile:Record<string,unknown>}
export function characterArchivePayload(draft:CharacterDraft):{archive:Record<string,unknown>;prompts:[]}
export function generationFailed<T extends CreationSession>(session:T):T
export function shouldConfirmLeave(draft:WorldDraft|CharacterDraft|null):boolean
