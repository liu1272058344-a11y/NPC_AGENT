export async function generate() { throw Object.assign(new Error('Stable Diffusion provider is not configured'), { code: 'IMAGE_PROVIDER_ERROR', statusCode: 501 }) }
