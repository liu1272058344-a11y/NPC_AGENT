import test from 'node:test'
import assert from 'node:assert/strict'
import { deploymentReadiness } from '../src/server/readiness.mjs'

test('readiness reports configured capabilities without returning secrets', () => {
  const env = {
    DATABASE_URL: 'postgres://secret-host/db',
    BLOB_READ_WRITE_TOKEN: 'blob-secret',
    CREDENTIAL_SESSION_SECRET: 'cookie-secret',
    CRON_SECRET: 'cron-secret'
  }
  const result = deploymentReadiness(env)
  assert.deepEqual(result, {
    ok: true,
    services: { assetPersistence: 'ready', credentialSessions: 'ready', scheduledCleanup: 'ready' }
  })
  const serialized = JSON.stringify(result)
  for (const secret of Object.values(env)) assert.equal(serialized.includes(secret), false)
  for (const name of Object.keys(env)) assert.equal(serialized.includes(name), false)
})

test('readiness marks incomplete deployment capabilities unavailable', () => {
  assert.deepEqual(deploymentReadiness({}), {
    ok: false,
    services: { assetPersistence: 'unavailable', credentialSessions: 'unavailable', scheduledCleanup: 'unavailable' }
  })
  assert.deepEqual(deploymentReadiness({ DATABASE_URL: 'db-only', CREDENTIAL_SESSION_SECRET: 'secret' }), {
    ok: false,
    services: { assetPersistence: 'unavailable', credentialSessions: 'ready', scheduledCleanup: 'unavailable' }
  })
})
