import test from 'node:test'
import assert from 'node:assert/strict'
import { requestStructured } from '../src/server/llmGateway.mjs'
import { generateContent } from '../src/server/contentGeneration.mjs'
import { requestConversationTurn } from '../src/content/conversationApi.mjs'
import {createConversationSession,beginConversationTurn,completeConversationTurn} from '../src/content/conversationSession.mjs'
const response = body => new Response(JSON.stringify(body))
const asset={type:'角色',style:'水彩',objects:['树'],composition:'正视',palette:'绿',lighting:'自然',details:['树叶'],format:'png',aspectRatio:'1:1',promptZh:'古树',promptEn:'ancient tree',negativePrompt:''}
const input={category:'character',itemId:'tree',requestId:'r',provider:'deepseek',model:'deepseek-chat',requirements:'古树'}
test('program owns category; label is not a model business decision',async()=>{
 const result=await generateContent(input,{requestStructured:async request=>{
  assert.equal(JSON.stringify(request.schema).includes('"category"'),false)
  return {category:'角色构想',design:{name:'古树',summary:'记忆',fields:{appearance:'蓝叶'}},asset}
 }})
 assert.equal(result.category,'character');assert.equal(result.requestId,'r')
})
test('schema diagnostics retain missing field paths and reject blank core fields',async()=>{
 for(const design of [{name:'古树',fields:{}},{name:'  ',summary:'记忆',fields:{}}]){
  await assert.rejects(generateContent(input,{requestStructured:async()=>({design,asset})}),e=>e.code==='INVALID_SCHEMA'&&e.issues.some(i=>i.path.includes('design')))
 }
})
test('Responses concatenates all output text parts and detects refusal',async()=>{
 const options={provider:'deepseek',model:'deepseek-flash',schema:{type:'object'},sleep:async()=>{}}
 assert.deepEqual(await requestStructured({...options,fetchImpl:async()=>response({status:'completed',output:[{content:[{type:'output_text',text:'{"ok":'},{type:'output_text',text:'true}'}]}]})}),{ok:true})
 await assert.rejects(requestStructured({...options,fetchImpl:async()=>response({status:'completed',output:[{content:[{type:'refusal',refusal:'no'}]}]})}),{code:'MODEL_REFUSAL'})
})
test('empty JSON output retries once, never more than two calls',async()=>{
 for(const succeeds of [true,false]){
  let calls=0
  const run=requestStructured({provider:'deepseek',model:'deepseek-chat',schema:{type:'object'},sleep:async()=>{},fetchImpl:async()=>response({choices:[{message:{content:++calls===2&&succeeds?'{}':''},finish_reason:'stop'}]})})
  if(succeeds)assert.deepEqual(await run,{})
  else await assert.rejects(run,{code:'EMPTY_RESPONSE'})
  assert.equal(calls,2)
 }
})
test('response requestId must match the submitted snapshot',async()=>{
 await assert.rejects(requestConversationTurn({id:'tree',kind:'character',messages:[{role:'user',content:'树'}]},{provider:'deepseek',model:'m',requestId:'new',fetchImpl:async()=>({ok:true,json:async()=>({requestId:'old',status:'needs_clarification',question:'用途'})})}),{code:'STALE_REQUEST'})
})
test('category-specific schema rejects fields from another category even with a correct label',async()=>{
 await assert.rejects(generateContent(input,{logger:()=>{},requestStructured:async()=>({category:'character',design:{name:'古树',summary:'记忆',fields:{routes:'地图路线'}},asset})}),{code:'INVALID_SCHEMA'})
})
test('snapshot isolates category, design, world and text while responses arrive out of order',async()=>{
 const a=beginConversationTurn(createConversationSession('character',{id:'w',name:'旧世界'},()=> 'a'),'古树','a-request')
 const b=beginConversationTurn(createConversationSession('map',null,()=> 'b'),'地图','b-request')
 const calls=[],releases=[]
 const fetchImpl=async(_url,init)=>{const payload=JSON.parse(init.body);calls.push(payload);await new Promise(resolve=>releases.push(resolve));return {ok:true,json:async()=>({requestId:payload.requestId,itemId:payload.designId,category:payload.selectedCategoryId,status:'complete',design:{name:payload.designId,summary:'摘要',fields:{}},asset})}}
 const pa=requestConversationTurn(a,{provider:'deepseek',model:'m',world:a.worldSnapshot,requestId:'a-request',fetchImpl})
 a.kind='prop';a.messages[0].content='changed';a.worldSnapshot.name='changed'
 const pb=requestConversationTurn(b,{provider:'deepseek',model:'m',requestId:'b-request',fetchImpl})
 releases[1]();const rb=await pb
 assert.equal(completeConversationTurn(b,'b-request',rb).design.name,'b')
 releases[0]();const ra=await pa
 assert.equal(calls[0].contentProfile.category,'character');assert.equal(calls[0].world.name,'旧世界');assert.equal(calls[0].messages[0].content,'古树')
 assert.equal(calls[1].contentProfile.category,'map')
 assert.equal(completeConversationTurn(b,'a-request',ra),b)
})
test('provider response with wrong nesting is not an empty response',async()=>{
 await assert.rejects(requestStructured({provider:'deepseek',model:'deepseek-chat',schema:{type:'object'},logger:()=>{},fetchImpl:async()=>response({content:'{}'})}),{code:'INVALID_MODEL_RESPONSE'})
})
test('timeout and active cancellation retain distinct error codes',async()=>{
 const fetchImpl=async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true}))
 const base={provider:'deepseek',model:'deepseek-chat',schema:{type:'object'},logger:()=>{},fetchImpl,sleep:async()=>{},timeoutMs:5}
 await assert.rejects(requestStructured(base),{code:'PROVIDER_TIMEOUT'})
 const controller=new AbortController(),pending=requestStructured({...base,timeoutMs:100,signal:controller.signal})
 controller.abort();await assert.rejects(pending,{code:'REQUEST_ABORTED'})
})
test('schema repair shares the two-call budget and retains the same context',async()=>{
 for(const succeeds of [true,false]){
  let calls=0;const requests=[]
  const result=generateContent(input,{logger:()=>{},requestStructured:request=>requestStructured({...request,sleep:async()=>{},fetchImpl:async(_url,init)=>{
   const body=JSON.parse(init.body);requests.push(body.messages.slice(1));calls++
   return response({choices:[{message:{content:JSON.stringify({design:{name:'古树',...(calls===2&&succeeds?{summary:'记忆'}:{}),fields:{appearance:'蓝叶'}},asset})},finish_reason:'stop'}]})
  }})})
  if(succeeds)assert.equal((await result).design.name,'古树');else await assert.rejects(result,{code:'INVALID_SCHEMA'})
  assert.equal(calls,2);assert.deepEqual(requests[0],requests[1])
 }
})
test('OpenAI uses strict structured schema with object root and nullable optional fields',async()=>{
 const result=await generateContent({...input,provider:'openai',model:'gpt-5'},{logger:()=>{},requestStructured:request=>requestStructured({...request,fetchImpl:async(_url,init)=>{
  const body=JSON.parse(init.body),schema=body.response_format.json_schema.schema
  assert.equal(body.max_tokens,undefined);assert.equal(body.max_completion_tokens,4000)
  assert.equal(body.response_format.type,'json_schema');assert.equal(schema.type,'object');assert.equal(schema.anyOf,undefined)
  const check=node=>{if(node.type==='object'){assert.deepEqual(node.required,Object.keys(node.properties));assert.equal(node.additionalProperties,false);Object.values(node.properties).forEach(check)};(node.anyOf || []).forEach(check);if(node.items)check(node.items)};check(schema)
  return response({choices:[{message:{content:JSON.stringify({result:{status:'complete',phase:'content',assistantMessage:null,suggestions:null,design:{name:'古树',summary:'记忆',fields:{appearance:'蓝叶',entityKind:null}},asset}})},finish_reason:'stop'}]})
 }})})
 assert.equal(result.category,'character');assert.equal(result.design.fields.entityKind,undefined)
})
test('unknown null fields cannot disappear during strict schema normalization',async()=>{
 await assert.rejects(generateContent({...input,provider:'openai',model:'gpt-5'},{logger:()=>{},requestStructured:request=>requestStructured({...request,sleep:async()=>{},fetchImpl:async()=>response({choices:[{message:{content:JSON.stringify({result:{design:{name:'树',summary:'摘要',fields:{appearance:'蓝叶',routes:null}},asset}})},finish_reason:'stop'}]})})}),{code:'INVALID_SCHEMA'})
})
test('non-JSON HTTP rate limit and authentication responses retain their status classification',async()=>{
 for(const [status,code] of [[429,'PROVIDER_RATE_LIMITED'],[401,'API_ERROR']]){
  let calls=0
  await assert.rejects(requestStructured({provider:'deepseek',model:'deepseek-chat',schema:{type:'object'},logger:()=>{},sleep:async()=>{},fetchImpl:async()=>{calls++;return new Response('upstream error',{status})}}),{code})
  assert.equal(calls,1)
 }
})
test('malformed Responses envelopes are invalid responses without network retry',async()=>{
 for(const body of [{output:{}},{output:[{content:{}}]},{output:[{content:[{type:'output_text',text:{}}]}]}]){
  let calls=0
  await assert.rejects(requestStructured({provider:'deepseek',model:'deepseek-flash',schema:{type:'object'},logger:()=>{},sleep:async()=>{},fetchImpl:async()=>{calls++;return response(body)}}),{code:'INVALID_MODEL_RESPONSE'})
  assert.equal(calls,1)
 }
})
