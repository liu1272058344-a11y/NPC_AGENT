const present = (value) => typeof value === 'string' && value.trim().length > 0

export const deploymentReadiness = (env = process.env) => {
  const services = {
    assetPersistence: present(env.DATABASE_URL) && present(env.BLOB_READ_WRITE_TOKEN) ? 'ready' : 'unavailable',
    credentialSessions: present(env.CREDENTIAL_SESSION_SECRET) ? 'ready' : 'unavailable',
    scheduledCleanup: present(env.CRON_SECRET) ? 'ready' : 'unavailable'
  }
  return { ok: Object.values(services).every((status) => status === 'ready'), services }
}
