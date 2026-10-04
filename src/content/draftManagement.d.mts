import type {ConversationSession} from './conversationSession.mjs'
type Sessions=Record<string,ConversationSession>
export const deletedDraftsKey:string
export function readDeletedDraftIds(storage:Storage):Set<string>
export function readRemovedDrafts(storage:Storage):Sessions
export function readStoredBuilderSessions(storage:Storage):Sessions
export function persistBuilderSessions(storage:Storage,sessions:Sessions):void
export function isEmptyDraft(session:ConversationSession):boolean
export function draftList(sessions:Sessions,filters?:{query?:string;kind?:string}):ConversationSession[]
export function removeDrafts(sessions:Sessions,ids:string[],selected:string):{sessions:Sessions;removed:Sessions;selected:string}
export function restoreDrafts(sessions:Sessions,removed:Sessions):Sessions
export function persistDraftRemoval(storage:Storage,sessions:Sessions,ids:string[],removed?:Sessions):void
export function persistDraftRestore(storage:Storage,sessions:Sessions,ids:string[]):void
export function renameDraft(session:ConversationSession,name:string):ConversationSession
