import test from 'node:test'
import assert from 'node:assert/strict'
import { migrateLocalAssetRecords } from '../src/agent/assetMigration.mjs'
import { classifyLegacyAsset } from '../src/content/categories.mjs'
test('known props do not get mistaken for characters and unknown records remain unclassified',()=>{
 assert.equal(classifyLegacyAsset({type:'角色道具'}),'prop')
 assert.equal(classifyLegacyAsset({type:'世界地图'}),'map')
 assert.equal(classifyLegacyAsset({type:'任意图片'}),'unknown')
})
test('migration marker prevents overwriting edited archives and is workspace scoped',async()=>{
 const values=new Map([['npc-forge-current-npc',JSON.stringify({id:'a',name:'Zero'})]])
 const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}
 let writes=0
 const api={workspaceId:'w1',saveRemoteArchive:async()=>{writes++},saveRemoteImage:async()=>{}}
 await migrateLocalAssetRecords(storage,api);await migrateLocalAssetRecords(storage,api)
 assert.equal(writes,1)
 await migrateLocalAssetRecords(storage,{...api,workspaceId:'w2'})
 assert.equal(writes,2)
})
test('mixed legacy NPC prompts stay pending and an NPC without an id gets a deterministic archive id',async()=>{
 const values=new Map([['npc-forge-current-npc',JSON.stringify({name:'Zero'})],['npc-forge-asset-library',JSON.stringify([{type:'世界地图',promptEn:'map'}])]])
 const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}
 const writes=[]
 await migrateLocalAssetRecords(storage,{workspaceId:'w',saveRemoteArchive:async value=>writes.push(value),saveRemoteImage:async()=>{}})
 assert.match(writes[0].archive.id,/^legacy-character-/)
 assert.equal(JSON.parse(storage.getItem('npc-forge-current-npc')).id,writes[0].archive.id)
 assert.equal(writes[0].archive.profile.category,'unknown')
 assert.equal(writes[0].archive.profile.needsClassification,true)
})

test('legacy world is saved first with a stable id and an unlinked character stays independent',async()=>{
 const values=new Map([
  ['npc-forge-current-world',JSON.stringify({name:'同名世界',summary:'旧世界'})],
  ['npc-forge-current-npc',JSON.stringify({name:'同名角色',summary:'旧角色'})]
 ])
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}
 const order=[]
 const api={workspaceId:'workspace-a',saveWorld:async value=>{order.push(['world',value]);return value},saveRemoteArchive:async value=>order.push(['character',value]),saveRemoteImage:async()=>{}}
 await migrateLocalAssetRecords(storage,api)
 await migrateLocalAssetRecords(storage,api)
 assert.deepEqual(order.map(([kind])=>kind),['world','character'])
 const savedWorld=JSON.parse(storage.getItem('npc-forge-current-world'))
 const savedCharacter=JSON.parse(storage.getItem('npc-forge-current-npc'))
 assert.match(savedWorld.id,/^legacy-world-/)
 assert.match(savedCharacter.id,/^legacy-character-/)
 assert.equal(order[1][1].archive.profile.worldId,undefined)
 assert.equal(storage.getItem('npc-forge-current-world')!==null,true)
 assert.equal(storage.getItem('npc-forge-current-npc')!==null,true)
})
