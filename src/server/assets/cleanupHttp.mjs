export async function handleCleanupRequest(request, service, secret = process.env.CRON_SECRET) {
  if (!secret || request.headers?.authorization !== `Bearer ${secret}`) return { status: 401, body: { ok: false, error: { code: 'UNAUTHORIZED', message: '无权执行清理任务。' } } }
  try { return { status: 200, body: { ok: true, data: await service.cleanupExpiredImages({ before: new Date().toISOString(), batchSize: 100 }) } } }
  catch (error) { return { status: Number(error?.statusCode) || 500, body: { ok: false, error: { code: error?.code || 'CLEANUP_FAILED', message: error?.message || '清理任务失败。' } } } }
}
