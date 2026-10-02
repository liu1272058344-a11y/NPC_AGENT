import test from 'node:test'
import assert from 'node:assert/strict'
import { buildContentLibrary, applyGenerationResult } from '../src/agent/contentLibrary.mjs'
test('filters worlds, categories, tags and derived production states',()=>{
 const rows=[{id:'a',name:'同名',category:'map',worldId:'w1',tags:['迷宫'],promptCount:2,imageCount:0,updatedAt:'2026-10-01'}, {id:'b',name:'同名',category:'prop',worldId:'w2',imageCount:1,updatedAt:'2026-10-02'}]
 assert.deepEqual(buildContentLibrary(rows,{worldId:'w1',category:'map',query:'迷宫',status:'prompt'}).items.map(x=>x.id),['a'])
 assert.deepEqual(buildContentLibrary(rows,{}).items.map(x=>x.id),['b','a'])
 assert.equal(buildContentLibrary(rows,{}).counts.map,1)
})
test('late result updates only the matching request and original item',()=>{
 const state={a:{requestId:'new'},b:{requestId:'b'}}
 assert.equal(applyGenerationResult(state,{itemId:'a',requestId:'old'},{asset:{}}),state)
 const result=applyGenerationResult(state,{itemId:'b',requestId:'b'},{asset:{promptEn:'kept'}})
 assert.equal(result.a,state.a)
 assert.equal(result.b.asset.promptEn,'kept')
})
