const providers = new Map()

export function registerProvider(name, adapter) { providers.set(name, adapter); return adapter }
export function getProvider(name) { return providers.get(name) }
export function listProviders() { return [...providers.keys()] }

registerProvider('deepseek', { name: 'deepseek', baseUrl: 'https://api.deepseek.com', protocol: 'chat-completions' })
registerProvider('openai', { name: 'openai', baseUrl: 'https://api.openai.com/v1', protocol: 'responses' })
