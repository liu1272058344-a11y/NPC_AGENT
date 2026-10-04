import {conversationStorageKey,editConversationSession,restoreConversationSessions} from './conversationSession.mjs'
import {libraryCategoryLabel} from './categories.mjs'

export const deletedDraftsKey='npc-forge-deleted-drafts-v1'
const readJSON=(storage,key,fallback)=>{try{return JSON.parse(storage.getItem(key) || 'null') || fallback}catch{return fallback}}
const readState=storage=>readJSON(storage,conversationStorageKey,{})
export function readStoredBuilderSessions(storage){const value=readState(storage);return value.version===2&&value.sessions?value.sessions:value}
const readJournal=storage=>{const value=readState(storage);return value.version===2?value:readJSON(storage,deletedDraftsKey,{})}
export function readDeletedDraftIds(storage){
 const journal=readJournal(storage),ids=Array.isArray(journal)?journal:journal?.ids
 return new Set(Array.isArray(ids)?ids.filter(id=>typeof id==='string'):[])
}
export const readRemovedDrafts=storage=>restoreConversationSessions(readJournal(storage)?.removed || {})
export function isEmptyDraft(s){
 return s.status==='draft'&&!s.pendingRequest&&!s.name?.trim()&&!s.input?.trim()&&!s.messages?.length&&!s.design&&!s.asset&&!s.worldValue&&!s.visualBrief?.trim()&&!s.tags?.length&&!Object.keys(s.overrides || {}).length&&!Object.keys(s.originalProfile || {}).length
}
export function draftList(sessions,{query='',kind=''}={}){
 const search=query.trim().toLowerCase()
 return Object.values(sessions).filter(s=>s.status!=='saved'&&(!kind||s.kind===kind)&&(!search||[s.name,s.input,s.design?.summary,s.worldValue?.summary,libraryCategoryLabel(s.kind),...(s.messages || []).map(m=>m.content)].join(' ').toLowerCase().includes(search))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id))
}
export function removeDrafts(sessions,ids,selected){
 const next={...sessions},removed={}
 for(const id of ids){const s=next[id];if(s&&s.status!=='saved'&&!s.pendingRequest){removed[id]=s;delete next[id]}}
 return {sessions:next,removed,selected:next[selected]?selected:Object.keys(next)[0] || ''}
}
export const restoreDrafts=(sessions,removed)=>({...removed,...sessions})
// Sessions, deletion markers and undo share one atomic localStorage write, so a
// full browser can remove/restore drafts without temporarily duplicating them.
export function persistBuilderSessions(storage,sessions){
 const ids=[...readDeletedDraftIds(storage)],removed=readRemovedDrafts(storage)
 storage.setItem(conversationStorageKey,JSON.stringify({version:2,sessions,ids,removed}))
}
export function persistDraftRemoval(storage,sessions,ids,removed={}){
 const deleted=readDeletedDraftIds(storage);for(const id of ids)deleted.add(id)
 storage.setItem(conversationStorageKey,JSON.stringify({version:2,sessions,ids:[...deleted],removed}))
}
export function persistDraftRestore(storage,sessions,ids){
 const deleted=readDeletedDraftIds(storage);for(const id of ids)deleted.delete(id)
 const remaining={...readRemovedDrafts(storage)};for(const id of ids)delete remaining[id]
 storage.setItem(conversationStorageKey,JSON.stringify({version:2,sessions,ids:[...deleted],removed:remaining}))
}
export function renameDraft(session,name){
 const trimmed=name.trim();if(!trimmed)throw new Error('请输入草稿名称。')
 return editConversationSession(session,{name:trimmed,...(session.design?{design:{...session.design,name:trimmed}}:{}),...(session.worldValue?{worldValue:{...session.worldValue,name:trimmed}}:{})})
}
