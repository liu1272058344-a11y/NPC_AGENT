import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequestGuard } from '../src/agent/requestGuard.mjs'

test('request guard prevents synchronous duplicates and ignores stale completion', () => {
  const guard = createRequestGuard()
  const first = guard.begin()
  assert.equal(guard.begin(), null)
  guard.finish(first)
  const second = guard.begin()
  assert.notEqual(second, null)
  assert.equal(guard.isCurrent(first), false)
  assert.equal(guard.isCurrent(second), true)
  guard.finish(first)
  assert.equal(guard.isCurrent(second), true)
  guard.finish(second)
  assert.equal(guard.isCurrent(second), false)
})

test('starting a new request aborts the previous request', () => {
  const guard = createRequestGuard()
  const first = guard.begin()
  const second = guard.begin({ replace: true })
  assert.equal(first.controller.signal.aborted, true)
  assert.equal(guard.isCurrent(second), true)
})
