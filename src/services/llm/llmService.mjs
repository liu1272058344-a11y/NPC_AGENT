import { requestStructured } from '../../server/llmGateway.mjs'
import { getProvider } from './providerRegistry.mjs'

export async function generateStructured(input) {
  if (!getProvider(input.provider)) {
    const error = new Error(`Unsupported LLM provider: ${input.provider}`)
    error.code = 'UNSUPPORTED_PROVIDER'
    throw error
  }
  return requestStructured(input)
}
