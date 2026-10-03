import test from 'node:test'
import assert from 'node:assert/strict'
import { buildContentContext, isPromptStale } from '../src/content/context.mjs'
import { generateContent } from '../src/server/contentGeneration.mjs'
const world={id:'w1',revision:2,name:'苔原',visualDirection:'石材与苔藓',coreRule:'树保存记忆'}
test('context inherits confirmed facts and preserves explicit overrides and pending fields',()=>{
 const result=buildContentContext({world,item:{id:'t1',revision:3,fields:{appearance:'古树',goal:''},visualBrief:'水彩'},overrides:{visualDirection:'版画'}})
 assert.equal(result.source.worldId,'w1');assert.equal(result.source.itemRevision,3);assert.equal(result.confirmed.world.coreRule,'树保存记忆');assert.equal(result.confirmed.visualDirection,'版画');assert.equal(result.conflicts.length,1);assert.ok(result.pending.includes('goal'))
 assert.equal(isPromptStale(result.source,world,{id:'t1',revision:4}),true)
 assert.equal(isPromptStale(result.source,world,{id:'t1',revision:3}),false)
 assert.equal(buildContentContext({item:{id:'a',worldId:'missing'}}).source.unavailable,true)
})
test('nonhuman generation accepts partial relevant fields and passes visual brief as context',async()=>{
 let request
 const result=await generateContent({category:'character',itemId:'t1',name:'古树',requirements:'入口的守护古树，不会说话',world,design:{entityKind:'plant',appearance:'树冠宽大'},visualBrief:'水彩',revision:3},{requestStructured:async input=>{request=input;return {category:'character',design:{name:'古树',summary:'入口守护者',fields:{entityKind:'plant',appearance:'树冠宽大',behavior:'枝条指路'}},asset:{type:'角色',style:'水彩',objects:['古树'],composition:'正视',palette:'绿',lighting:'柔光',details:['苔藓'],format:'png',aspectRatio:'1:1',promptZh:'守护古树',promptEn:'guardian tree',negativePrompt:''}}}})
 assert.equal(result.design.fields.equipment,undefined);assert.equal(result.context.source.worldRevision,2);assert.match(request.instructions,/石材与苔藓/);assert.match(request.instructions,/水彩/)
})
