import type { CharacterDraft, CreationSession, WorldDraft } from './creationSession.mjs'
export function worldArchivePayload(draft:WorldDraft):{id:string;name:string;profile:Record<string,unknown>}
export function characterArchivePayload(draft:CharacterDraft):{archive:Record<string,unknown>;prompts:[]}
export function generationFailed<T extends CreationSession>(session:T):T
export function shouldConfirmLeave(draft:WorldDraft|CharacterDraft|null):boolean
export function readCreationSaveStates(storage:{getItem(key:string):string|null}):{world:'unsaved'|'saved'|'dirty';character:'unsaved'|'saved'|'dirty'}
export function writeCreationSaveStates(storage:{setItem(key:string,value:string):void},states:{world:'unsaved'|'saved'|'dirty';character:'unsaved'|'saved'|'dirty'}):void
export function hasUnsavedCreationDraft(states:{world:'unsaved'|'saved'|'dirty';character:'unsaved'|'saved'|'dirty'},world:unknown,npc:unknown):boolean
