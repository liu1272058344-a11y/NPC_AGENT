import test from 'node:test'
import assert from 'node:assert/strict'
import {requestConversationTurn} from '../src/content/conversationApi.mjs'
test('conversation API sends history, live world, and revision intent',async()=>{
 const s={id:'c',kind:'character',worldId:'w',revision:2,name:'树',messages:[{id:'u',role:'user',content:'古树'}],design:{name:'树',summary:'旧',fields:{appearance:'蓝叶'}}}
 const result=await requestConversationTurn(s,{provider:'deepseek',model:'m',world:{id:'w',coreRule:'记忆'},requestId:'r',fetchImpl:async(url,init)=>{const b=JSON.parse(init.body);assert.equal(url,'/api/npc');assert.equal(b.messages[0].content,'古树');assert.equal(b.intent,'revise');assert.equal(b.contentProfile.currentDesign.fields.appearance,'蓝叶');assert.equal(b.world.id,'w');return {ok:true,json:async()=>({status:'needs_clarification',question:'用途？'})}}})
 assert.equal(result.question,'用途？')
})
test('legacy continuation sends original confirmed facts and rejects mismatched clarification',async()=>{
 const s={id:'old',kind:'character',revision:1,messages:[{role:'user',content:'更古老一点'}],design:{fields:{}},originalProfile:{goal:'保存记忆',behaviorRules:['不移动']}}
 await assert.rejects(requestConversationTurn(s,{provider:'deepseek',model:'m',requestId:'r',fetchImpl:async(_url,init)=>{const body=JSON.parse(init.body);assert.equal(body.contentProfile.currentDesign.legacyProfile.goal,'保存记忆');return {ok:true,json:async()=>({status:'needs_clarification',itemId:'another',question:'用途？'})}}}),/不一致/)
})

