const fail = (code, statusCode, message) => Object.assign(new Error(message), { code, statusCode })
const positive = (value, fallback) => {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw fail('INTERNAL_BETA_NOT_CONFIGURED', 503, '内测额度配置无效。')
  return parsed
}

export const internalBetaLimits = (env = process.env) => ({
  maxImages: positive(env.INTERNAL_BETA_MAX_IMAGES, 200),
  maxBytes: positive(env.INTERNAL_BETA_MAX_BYTES, 1024 * 1024 * 1024),
  dailyActions: positive(env.INTERNAL_BETA_DAILY_ACTIONS, 30),
})

export const createInternalBetaUsageStore = (query, env = process.env, now = () => new Date()) => {
  const limits = internalBetaLimits(env)
  const dateKey = () => now().toISOString().slice(0, 10)
  return {
    limits,
    async reserveDailyAction(_kind, { unlimited = false } = {}) {
      const result = await query(`INSERT INTO internal_beta_daily_usage (usage_date, action_kind, action_count)
        VALUES ($1,$2,1)
        ON CONFLICT (usage_date, action_kind) DO UPDATE SET action_count = internal_beta_daily_usage.action_count + 1
          WHERE ($3::integer IS NULL OR internal_beta_daily_usage.action_count < $3)
        RETURNING action_count, true AS accepted`, [dateKey(), unlimited ? 'admin' : 'all', unlimited ? null : limits.dailyActions])
      const row = result.rows[0]
      if (!row || row.accepted === false || row.accepted === 'false') throw fail('DAILY_COST_LIMIT_REACHED', 429, '今日内测成本额度已用完，请明天继续。')
      return { dailyActions: Number(row.action_count), limit: unlimited ? null : limits.dailyActions }
    },
    async getProjectUsage({ unlimited = false } = {}) {
      const [assets, daily] = await Promise.all([
        query('SELECT COUNT(*) AS image_count, COALESCE(SUM(byte_size),0) AS byte_count FROM image_assets', []),
        query('SELECT COALESCE(SUM(action_count),0) AS action_count FROM internal_beta_daily_usage WHERE usage_date=$1', [dateKey()]),
      ])
      return { imageCount: Number(assets.rows[0]?.image_count || 0), byteCount: Number(assets.rows[0]?.byte_count || 0), dailyActions: Number(daily.rows[0]?.action_count || 0), limits: unlimited ? { maxImages:null,maxBytes:null,dailyActions:null } : limits, ...(unlimited ? { unlimited:true } : {}) }
    },
  }
}
