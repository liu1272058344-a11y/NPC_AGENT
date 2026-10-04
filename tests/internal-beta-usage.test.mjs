import test from 'node:test'
import assert from 'node:assert/strict'
import { createInternalBetaUsageStore } from '../src/server/internalBeta/usage.mjs'

test('daily reservations use defaults and reject the thirty-first action', async () => {
  let count = 0
  const query = async (sql, values) => {
    assert.match(sql, /internal_beta_daily_usage/)
    assert.equal(values[2], 30)
    const accepted = count < values[2]
    if (accepted) count += 1
    return { rows: [{ action_count: count, accepted }] }
  }
  const store = createInternalBetaUsageStore(query, {}, () => new Date('2026-10-01T12:00:00Z'))
  for (let index = 0; index < 30; index += 1) await store.reserveDailyAction('image')
  await assert.rejects(store.reserveDailyAction('image'), { code: 'DAILY_COST_LIMIT_REACHED', statusCode: 429 })
})

test('environment overrides are validated and usage aggregates are numeric', async () => {
  const calls = []
  const query = async (sql, values) => {
    calls.push({ sql, values })
    if (/internal_beta_daily_usage/.test(sql) && /SELECT/.test(sql) && !/INSERT/.test(sql)) return { rows: [{ action_count: '7' }] }
    return { rows: [{ image_count: '12', byte_count: '4096' }] }
  }
  const store = createInternalBetaUsageStore(query, { INTERNAL_BETA_MAX_IMAGES: '250', INTERNAL_BETA_MAX_BYTES: '2048', INTERNAL_BETA_DAILY_ACTIONS: '45' }, () => new Date('2026-10-01T12:00:00Z'))
  assert.deepEqual(await store.getProjectUsage(), { imageCount: 12, byteCount: 4096, dailyActions: 7, limits: { maxImages: 250, maxBytes: 2048, dailyActions: 45 } })
  assert.equal(calls.length, 2)
})

test('invalid limit configuration fails closed', () => {
  assert.throws(() => createInternalBetaUsageStore(async () => ({ rows: [] }), { INTERNAL_BETA_DAILY_ACTIONS: '0' }), { code: 'INTERNAL_BETA_NOT_CONFIGURED' })
})

test('admin usage reports unlimited quotas while preserving project totals',async()=>{
 const store=createInternalBetaUsageStore(async sql=>({rows:[sql.includes('image_assets')?{image_count:'240',byte_count:'2147483648'}:{action_count:'80'}]}))
 const usage=await store.getProjectUsage({unlimited:true})
 assert.equal(usage.unlimited,true)
 assert.deepEqual(usage.limits,{maxImages:null,maxBytes:null,dailyActions:null})
 assert.equal(usage.dailyActions,80);assert.equal(usage.imageCount,240)
})
