import test from 'node:test'
import assert from 'node:assert/strict'
import {readBuilderSessions,pipelineSessions} from '../src/content/builderState.mjs'
test('legacy local identity is the same stable id used by migration',()=>{
 const values={'npc-forge-current-world':JSON.stringify({name:'旧世界',coreRule:'记忆'}),'npc-forge-workspace-id':'w'}
 const storage={getItem:key=>values[key],setItem:(key,value)=>{values[key]=value}}
 const first=readBuilderSessions(storage),second=readBuilderSessions(storage)
 assert.deepEqual(Object.keys(first),Object.keys(second));assert.equal(first[Object.keys(first)[0]].id,JSON.parse(values['npc-forge-current-world']).id)
})
test('restore real legacy drafts without inventing dialogue or names',()=>{
 const store={getItem:key=>key==='npc-forge-current-npc'?JSON.stringify({id:'npc',name:'古树',personality:['沉默'],behaviorRules:['保留记忆'],worldId:'missing'}):null}
 const sessions=readBuilderSessions(store,()=> 'new')
 assert.equal(sessions.npc.name,'古树');assert.deepEqual(sessions.npc.messages,[])
 assert.deepEqual(sessions.npc.originalProfile.behaviorRules,['保留记忆'])
})
test('pipeline import keeps exact output and generates no additional request',()=>{
 let id=0;const result={project:{name:'树世界',world:{name:'树世界',coreRule:'记忆存于树',summary:'探索'},characters:[{name:'石头',personality:['安静']}],assets:[]},visual:{visual_prompt:'exact\ntext',negative_prompt:'negative'}}
 const sessions=pipelineSessions(result,()=>String(++id))
 assert.equal(sessions.length,2);assert.equal(sessions[1].worldId,sessions[0].id)
 assert.equal(sessions[1].asset.promptEn,'exact\ntext');assert.deepEqual(sessions[0].messages,[])
})
