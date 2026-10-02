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
test('mixed legacy NPC prompts stay pending and an NPC without an id keeps a stable archive id',async()=>{
 const values=new Map([['npc-forge-current-npc',JSON.stringify({name:'Zero'})],['npc-forge-asset-library',JSON.stringify([{type:'世界地图',promptEn:'map'}])]])
 const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}
 const writes=[]
 await migrateLocalAssetRecords(storage,{workspaceId:'w',saveRemoteArchive:async value=>writes.push(value),saveRemoteImage:async()=>{}})
 assert.equal(writes[0].archive.id,'legacy-npc')
 assert.equal(writes[0].archive.profile.category,'unknown')
 assert.equal(writes[0].archive.profile.needsClassification,true)
})
