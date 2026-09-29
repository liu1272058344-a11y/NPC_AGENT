export async function generateVideo({ prompt }) {
  if (!prompt?.trim()) throw new Error('video prompt is required')
  return { status: 'queued', provider: null, prompt }
}
