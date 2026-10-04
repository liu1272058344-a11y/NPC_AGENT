import test from 'node:test'
import assert from 'node:assert/strict'
import {createConversationSession,conversationStorageKey} from '../src/content/conversationSession.mjs'
import {readBuilderSessions} from '../src/content/builderState.mjs'
import {draftList,isEmptyDraft,removeDrafts,restoreDrafts,persistDraftRemoval,persistDraftRestore,renameDraft,readRemovedDrafts,persistBuilderSessions} from '../src/content/draftManagement.mjs'

const draft=(id,patch={})=>({...createConversationSession('character',null,()=>id),...patch})
const store=values=>({getItem:key=>values[key] ?? null,setItem:(key,value)=>{values[key]=value}})

test('manager includes blank drafts, searches content and filters type while distinguishing local changes',()=>{
 const sessions={empty:draft('empty'),tree:draft('tree',{name:'古树',kind:'prop'}),dirty:draft('dirty',{status:'dirty',messages:[{role:'user',content:'生命石'}]}),saved:draft('saved',{status:'saved'})}
 assert.equal(draftList(sessions).length,3)
 assert.deepEqual(draftList(sessions,{query:'生命石'}).map(s=>s.id),['dirty'])
 assert.deepEqual(draftList(sessions,{kind:'prop'}).map(s=>s.id),['tree'])
 assert.equal(isEmptyDraft(sessions.empty),true)
 for(const patch of [{status:'dirty'},{input:'文字'},{name:'名字'},{messages:[{content:'想法'}]},{design:{}},{worldValue:{}},{asset:{}},{visualBrief:'视觉要求'},{overrides:{style:'水彩'}},{originalProfile:{background:'旧资料'}},{pendingRequest:{id:'r'}}])assert.equal(isEmptyDraft(draft('x',patch)),false)
})

test('batch removal protects saved and busy sessions and chooses a remaining selection',()=>{
 const sessions={a:draft('a'),b:draft('b',{status:'dirty'}),saved:draft('saved',{status:'saved'}),busy:draft('busy',{pendingRequest:{id:'r'}})}
 const result=removeDrafts(sessions,['a','b','saved','busy'],'a')
 assert.deepEqual(Object.keys(result.removed),['a','b'])
 assert.deepEqual(Object.keys(result.sessions),['saved','busy'])
 assert.equal(result.selected,'saved')
 assert.deepEqual(restoreDrafts(result.sessions,result.removed),sessions)
 const all=removeDrafts({a:sessions.a},['a'],'a')
 assert.equal(all.selected,'');assert.deepEqual(all.sessions,{})
})

test('deletion persists across reload including legacy sources, and undo restores the exact drafts',()=>{
 const a=draft('a',{name:'旧角色'}),b=draft('b',{kind:'world'})
 const values={[conversationStorageKey]:JSON.stringify({a,b}),'npc-forge-content-drafts-v1':JSON.stringify({a:{id:'a',category:'character',name:'旧角色'}}),'npc-forge-current-world':JSON.stringify({id:'b',name:'旧世界'})}
 const storage=store(values),result=removeDrafts({a,b},['a','b'],'a')
 persistDraftRemoval(storage,result.sessions,Object.keys(result.removed),result.removed)
 const loaded=readBuilderSessions(storage,()=> 'fresh')
 assert.deepEqual(Object.keys(loaded),['fresh'])
 assert.deepEqual(JSON.parse(JSON.stringify(readRemovedDrafts(storage))),JSON.parse(JSON.stringify({a,b})))
 const restored=restoreDrafts(result.sessions,result.removed)
 persistDraftRestore(storage,restored,Object.keys(result.removed))
 assert.deepEqual(JSON.parse(JSON.stringify(readBuilderSessions(storage))),JSON.parse(JSON.stringify({a,b})))
 assert.deepEqual(readRemovedDrafts(storage),{})
})

test('a failed persistence write rolls back removal and leaves reload unchanged',()=>{
 const a=draft('a'),values={[conversationStorageKey]:JSON.stringify({a})},storage=store(values)
 let failed=false;const write=storage.setItem
 storage.setItem=(key,value)=>{if(key===conversationStorageKey&&!failed){failed=true;throw new Error('quota')}write(key,value)}
 assert.throws(()=>persistDraftRemoval(storage,{},['a'],{a}),/quota/)
 assert.equal(readBuilderSessions(storage).a.id,'a')
 assert.deepEqual(readRemovedDrafts(storage),{})
})

test('delete and undo fit near storage quota without duplicating draft payloads',()=>{
 const a=draft('a',{input:'a'.repeat(4000)}),b=draft('b',{input:'b'.repeat(4000)})
 const values={[conversationStorageKey]:JSON.stringify({a,b})},storage=store(values),limit=values[conversationStorageKey].length+600,write=storage.setItem
 storage.setItem=(key,value)=>{const candidate={...values,[key]:value};if(Object.values(candidate).join('').length>limit)throw new Error('quota');write(key,value)}
 persistDraftRemoval(storage,{b},['a'],{a})
 assert.deepEqual(Object.keys(readBuilderSessions(storage)),['b'])
 persistDraftRestore(storage,{a,b},['a'])
 assert.deepEqual(Object.keys(readBuilderSessions(storage)),['a','b'])
})

test('undo preserves a newer session and rename preserves generated design and flags local changes',()=>{
 const original=draft('a',{design:{name:'AI名称',summary:'故事',fields:{appearance:'石头'}},asset:{promptEn:'exact'},status:'dirty'})
 const renamed=renameDraft(original,' 新名字 ')
 assert.equal(renamed.name,'新名字');assert.equal(renamed.design.name,'新名字')
 assert.equal(renamed.design.summary,'故事');assert.equal(renamed.asset.promptEn,'exact')
 assert.equal(renamed.status,'dirty');assert.equal(renamed.revision,original.revision+1)
 assert.equal(restoreDrafts({a:renamed},{a:original}).a,renamed)
 assert.throws(()=>renameDraft(original,'  '))
})

test('delete all, reload, persist and undo keeps deletion markers and restores original content',()=>{
 const a=draft('a',{input:'真实设计'}),values={[conversationStorageKey]:JSON.stringify({a})},storage=store(values)
 persistDraftRemoval(storage,{},['a'],{a})
 const loaded=readBuilderSessions(storage,()=> 'fresh')
 persistBuilderSessions(storage,loaded)
 assert.deepEqual(Object.keys(readBuilderSessions(storage)),['fresh'])
 assert.equal(readRemovedDrafts(storage).a.input,'真实设计')
 const restored=restoreDrafts(loaded,readRemovedDrafts(storage))
 persistDraftRestore(storage,restored,['a'])
 assert.equal(readBuilderSessions(storage).a.input,'真实设计')
 assert.deepEqual(readRemovedDrafts(storage),{})
})

test('opening a saved archive again clears its old local undo without overwriting cloud state',()=>{
 const a=draft('a',{status:'dirty',input:'旧修改'}),storage=store({})
 persistDraftRemoval(storage,{},['a'],{a})
 const saved=draft('a',{status:'saved',name:'云端版本'})
 persistDraftRestore(storage,{a:saved},['a'])
 assert.deepEqual(readRemovedDrafts(storage),{})
 assert.equal(readBuilderSessions(storage).a.name,'云端版本')
})
