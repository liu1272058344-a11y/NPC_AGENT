import { GatewayError } from './errors.mjs'

// Gemini credentials are deployment configuration, never browser-supplied keys.
export function geminiConfig(model, env = process.env) {
  if (!env.GEMINI_API_KEY?.trim()) throw new GatewayError('CONFIGURATION_ERROR', 'Gemini 服务尚未配置。', {statusCode:503})
  return {provider:'gemini',key:env.GEMINI_API_KEY.trim(),model:typeof model === 'string' && /^gemini-[a-z0-9.-]+$/.test(model) ? model : env.GEMINI_MODEL || 'gemini-4-argon'}
}
