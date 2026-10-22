import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/npc.ts'
const request=(body)=>({method:'POST',headers:{host:'localhost:8787',origin:'http://localhost:8787'},body})
const response=()=>({statusCode:200,setHeader(){},status(code){this.statusCode=code;return this},json(body){this.body=body;return this}})
test('Vercel rejects Gemini legacy requests before any external call',async()=>{
 process.env.GEMINI_API_KEY='server-only-secret'
 const saved=globalThis.fetch;let calls=0
 globalThis.fetch=async()=>{calls++;return Response.json({})}
 try {
  const res=response();await handler(request({provider:'gemini',action:'analyze',requestId:'legacy'}),res)
  assert.equal(res.statusCode,400)
  assert.equal(res.body.code,'INVALID_REQUEST')
  assert.equal(calls,0)
 }finally{globalThis.fetch=saved;delete process.env.GEMINI_API_KEY}
})
test('Vercel reports missing Gemini configuration using stable public errors',async()=>{
 delete process.env.GEMINI_API_KEY
 const res=response();await handler(request({provider:'gemini',messages:[{role:'user',content:'hello'}],requestId:'missing'}),res)
 assert.equal(res.statusCode,503)
 assert.equal(res.body.code,'CONFIGURATION_ERROR')
 assert.equal(res.body.requestId,'missing')
 assert.equal(res.body.retryable,false)
})

test('Vercel Gemini generation ignores browser keys and preserves clarification flow',async()=>{
 process.env.GEMINI_API_KEY='server-only-secret'
 const saved=globalThis.fetch
 globalThis.fetch=async(url,init)=>{
  assert.match(url,/generativelanguage.googleapis.com/)
  assert.equal(init.headers['x-goog-api-key'],'server-only-secret')
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({status:'needs_clarification',phase:'world',question:'什么时代？'})}]},finishReason:'STOP'}]})
 }
 try {
  const res=response();await handler(request({provider:'gemini',model:'gemini-4-argon',key:'browser-key',apiKey:'browser-key',messages:[{role:'user',content:'设计世界'}],requestId:'success'}),res)
  assert.equal(res.statusCode,200)
  assert.equal(res.body.status,'needs_clarification')
  assert.equal(res.body.requestId,'success')
  assert.equal(JSON.stringify(res.body).includes('server-only-secret'),false)
 }finally{globalThis.fetch=saved;delete process.env.GEMINI_API_KEY}
})

test('local HTTP Gemini route uses env key without personal credential cookie',async()=>{
 const {startServer}=await import('../server.mjs')
 process.env.GEMINI_API_KEY='local-server-secret'
 const saved=globalThis.fetch,server=startServer(0)
 globalThis.fetch=async(url,init)=>{
  assert.equal(init.headers['x-goog-api-key'],'local-server-secret')
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({status:'needs_clarification',phase:'world',question:'什么时代？'})}]},finishReason:'STOP'}]})
 }
 try {
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve))
  const base=`http://localhost:${server.address().port}`
  const result=await saved(`${base}/api/npc`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({provider:'gemini',key:'browser-key',apiKey:'browser-key',messages:[{role:'user',content:'设计世界'}]})})
  assert.equal(result.status,200)
  assert.equal((await result.json()).status,'needs_clarification')
 }finally{globalThis.fetch=saved;delete process.env.GEMINI_API_KEY;await new Promise(resolve=>server.close(resolve))}
})
