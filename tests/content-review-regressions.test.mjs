import test from 'node:test'
import assert from 'node:assert/strict'
import { createAssetService } from '../src/server/assets/assetService.mjs'
import { createAssetDatabase } from '../src/server/assets/database.mjs'
import { creationSelectionFromWorld } from '../src/agent/creationArchiveNavigation.mjs'
import { transitionDraft } from '../src/content/draftState.mjs'
test('JSONB reordered keys do not change world revision',async()=>{
 let stored={id:'w',name:'森林',profile:{revision:4,summary:'森林',visualDirection:'水彩'}}
 const service=createAssetService({db:{ensureWorkspace:async()=>{},findWorld:async()=>stored,upsertWorld:async(_w,v)=>(stored=v)},blob:{}})
 const result=await service.saveWorld('ws',{id:'w',name:'森林',profile:{visualDirection:'水彩',summary:'森林'}})
 assert.equal(result.profile.revision,4)
})
test('JSONB reordered snapshot permits identical prompt retry',async()=>{
 const db=createAssetDatabase(async sql=>({rows:sql.startsWith('SELECT')?[{id:'p',archive_id:'a',prompt:'tree',snapshot_json:{mode:'generated',context:{itemId:'t',worldId:'w'}}}]:[]}))
 const result=await db.insertPrompt('w','a',{id:'p',prompt:'tree',snapshot:{context:{worldId:'w',itemId:'t'},mode:'generated'}})
 assert.equal(result.prompt,'tree')
})
test('world library navigation keeps visual direction and revision',()=>{
 const result=creationSelectionFromWorld({id:'w',name:'森林',profile:{name:'森林',visualDirection:'水彩',revision:4}})
 assert.equal(result.world.visualDirection,'水彩');assert.equal(result.world.revision,4)
})
test('remote replacement of current dirty draft requires a decision',()=>{
 const state={selected:'a',drafts:{a:{id:'a',dirty:true,name:'unsaved'}}}
 assert.equal(transitionDraft(state,{targetId:'a',replacement:true}).needsDecision,true)
})
test('image association preserves latest saved archive metadata',async()=>{
 let saved
 const latest={id:'a',name:'新版名称',summary:'更新摘要',profile:{category:'map',revision:5,visualBrief:'新简报'}}
 const db={getArchiveDetail:async()=>({archive:latest}),ensureWorkspace:async()=>{},findByIdempotencyKey:async()=>null,reserveQuota:async()=>({}),upsertArchive:async(_w,a)=>{saved=a},insertPrompt:async()=>{},insertImageAsset:async r=>r,releaseQuota:async()=>{}}
 const service=createAssetService({db,source:async()=>({bytes:new Uint8Array([1]),contentType:'image/png',byteSize:1}),blob:{putImage:async()=>({url:'fixture'}),deleteImage:async()=>{}}})
 await service.saveGeneratedImage({workspaceId:'w',archive:{id:'a',name:'旧名称',profile:{category:'map',revision:1}},prompt:{prompt:'tree'},idempotencyKey:'r',sourceUrl:'fixture'})
 assert.equal(saved?.name || latest.name,'新版名称');assert.equal(saved?.profile?.revision || latest.profile.revision,5)
})
