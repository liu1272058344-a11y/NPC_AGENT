import test from 'node:test'
import assert from 'node:assert/strict'
import { guardBetaRequest } from '../src/server/internalBeta/guard.mjs'
import { createBetaSession } from '../src/server/internalBeta/session.mjs'
import { createInternalBetaUsageStore } from '../src/server/internalBeta/usage.mjs'

const env = { VERCEL: '1', DATABASE_URL: 'postgres://example', INTERNAL_BETA_PASSWORD: 'tester-secret', INTERNAL_BETA_ADMIN_PASSWORD: 'admin-secret', INTERNAL_BETA_SESSION_SECRET: 'a-very-long-session-signing-secret-value' }
const request = () => ({ headers: { cookie: createBetaSession('tester', env).cookie } })

test('unauthenticated request fails before quota storage is created', async () => {
  let created = false
  await assert.rejects(guardBetaRequest({ headers: {} }, { env, costKind: 'image', createStore: async () => { created = true } }), { code: 'INTERNAL_BETA_AUTH_REQUIRED' })
  assert.equal(created, false)
})

test('cost request reserves daily action without changing its payload', async () => {
  const payload = { prompt: '完整高质量提示词', model: 'quality-model', size: '2048x2048' }
  let kind = ''
  const session = await guardBetaRequest(request(), { env, costKind: 'image', createStore: async () => ({ reserveDailyAction: async (value) => { kind = value } }) })
  assert.equal(kind, 'image')
  assert.equal(session.role, 'tester')
  assert.deepEqual(payload, { prompt: '完整高质量提示词', model: 'quality-model', size: '2048x2048' })
})

test('daily rejection propagates before caller can run upstream work', async () => {
  const error = Object.assign(new Error('limit'), { code: 'DAILY_COST_LIMIT_REACHED', statusCode: 429 })
  await assert.rejects(guardBetaRequest(request(), { env, costKind: 'npc', createStore: async () => ({ reserveDailyAction: async () => { throw error } }) }), { code: 'DAILY_COST_LIMIT_REACHED' })
})

test('authenticated admin exceeds daily quota and still records usage independently of testers',async()=>{
 const counts=new Map()
 const store=createInternalBetaUsageStore(async(_sql,values)=>{
  const count=counts.get(values[1]) || 0,accepted=values[2]===null || count<values[2]
  if(accepted)counts.set(values[1],count+1)
  return {rows:[{action_count:counts.get(values[1]),accepted}]}
 },env)
 const admin={headers:{cookie:createBetaSession('admin',env).cookie}}
 for(let i=0;i<35;i++)assert.equal((await guardBetaRequest(admin,{env,costKind:'image',createStore:async()=>store})).role,'admin')
 assert.equal(counts.get('admin'),35)
 for(let i=0;i<30;i++)await guardBetaRequest(request(),{env,costKind:'npc',createStore:async()=>store})
 await assert.rejects(guardBetaRequest({...request(),body:{role:'admin',unlimited:true}},{env,costKind:'image',createStore:async()=>store}),{code:'DAILY_COST_LIMIT_REACHED'})
 assert.equal(counts.get('all'),30)
})
