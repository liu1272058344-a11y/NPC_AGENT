import test from 'node:test'
import assert from 'node:assert/strict'
import { createContentHandoff } from '../src/content/handoff.mjs'
import { createAssetService } from '../src/server/assets/assetService.mjs'
import { createAssetDatabase } from '../src/server/assets/database.mjs'
test('each content category inherits world identity without requiring NPC',()=>{
 for(const category of ['character','map','scene','prop']){
  const result=createContentHandoff({id:'w1',name:'雨林',revision:2,visualDirection:'湿润水彩'},category,()=> 'item1')
  assert.equal(result.id,'item1');assert.equal(result.worldId,'w1');assert.equal(result.category,category);assert.equal(result.fields.speechStyle,undefined)
 }
})
test('world revision advances only on change and retains visual direction',async()=>{
 let stored={id:'w',name:'雨林',profile:{name:'雨林',visualDirection:'水彩',revision:2}}
 const service=createAssetService({db:{ensureWorkspace:async()=>{},findWorld:async()=>stored,upsertWorld:async(_w,v)=>(stored=v)},blob:{}})
 assert.equal((await service.saveWorld('ws',{id:'w',name:'雨林',profile:{name:'雨林',visualDirection:'水彩'}})).profile.revision,2)
 assert.equal((await service.saveWorld('ws',{id:'w',name:'雨林',profile:{name:'雨林',visualDirection:'版画'}})).profile.revision,3)
})
test('existing prompt ID cannot be reused with different text',async()=>{
 const db=createAssetDatabase(async sql=>({rows:sql.startsWith('SELECT')?[{id:'p',archive_id:'a',prompt:'original',negative_prompt:'',prompt_zh:'',provider:'x',model_id:'y',snapshot_json:{}}]:[]}))
 await assert.rejects(db.insertPrompt('w','a',{id:'p',prompt:'changed',provider:'x',modelId:'y'}),{statusCode:409})
 const old=await db.insertPrompt('w','a',{id:'p',prompt:'original',provider:'x',modelId:'y'})
 assert.equal(old.prompt,'original')
})
