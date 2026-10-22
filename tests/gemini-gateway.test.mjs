import test from 'node:test'
import assert from 'node:assert/strict'
import { requestStructured } from '../src/server/llmGateway.mjs'
const schema = {type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false}
const options = {provider:'gemini',key:'server-secret',model:'gemini-4-argon',messages:[{role:'user',content:'hello'},{role:'assistant',content:'previous'},{role:'user',content:'continue'}],instructions:'Return JSON',schema,logger:()=>{},sleep:async()=>{}}
const success = {candidates:[{content:{role:'model',parts:[{thought:true,text:'private reasoning'},{text:'{"ok":'},{text:'true}'}]},finishReason:'STOP',index:0}],usageMetadata:{promptTokenCount:5,candidatesTokenCount:4,totalTokenCount:9}}
test('Gemini converts conversation, authenticates in header and parses only answer text', async()=>{
 const result = await requestStructured({...options,fetchImpl:async(url,init)=>{
  assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-4-argon:generateContent')
  assert.equal(init.headers['x-goog-api-key'],'server-secret')
  assert.equal(init.headers.Authorization,undefined)
  const body=JSON.parse(init.body)
  assert.deepEqual(body.contents.map(m=>m.role),['user','model','user'])
  assert.equal(body.systemInstruction.parts[0].text.includes('Return JSON'),true)
  assert.deepEqual(body.generationConfig.responseJsonSchema,schema)
  assert.equal(body.generationConfig.responseMimeType,'application/json')
  assert.equal(init.body.includes('server-secret'),false)
  return Response.json(success)
 }})
 assert.deepEqual(result,{ok:true})
})
for (const [name,payload,code] of [
 ['blocked',{promptFeedback:{blockReason:'SAFETY'}},'MODEL_REFUSAL'],
 ['truncated',{candidates:[{content:{parts:[{text:'{"ok":true}'}]},finishReason:'MAX_TOKENS'}]},'API_ERROR'],
 ['empty',{candidates:[{content:{parts:[]},finishReason:'STOP'}]},'EMPTY_RESPONSE'],
 ['malformed',{candidates:'bad'},'INVALID_MODEL_RESPONSE']
]) test(`Gemini rejects ${name} output`,async()=>{
 await assert.rejects(requestStructured({...options,fetchImpl:async()=>Response.json(payload)}),{code})
})
test('Gemini rate limits use the public error contract without leaking key',async()=>{
 let calls=0
 await assert.rejects(requestStructured({...options,fetchImpl:async()=>{calls++;return Response.json({error:{message:'server-secret'}},{status:429})}}),e=>e.code==='PROVIDER_RATE_LIMITED'&&!e.message.includes('server-secret'))
 assert.equal(calls,1)
})
