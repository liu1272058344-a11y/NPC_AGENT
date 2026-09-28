export interface PipelineResult {
  project: { project_id: string; name: string; genre: string; style: string; world: Record<string, unknown>; characters: Record<string, unknown>[]; assets: Record<string, unknown>[] }
  visual: { visual_prompt: string; negative_prompt: string; style_tags: string[]; camera: string; lighting: string }
}

export async function runPipeline(requirement: string, style = ''): Promise<PipelineResult> {
  const response = await fetch('/api/pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirement, style, assetType: 'character' }) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Pipeline 执行失败')
  return body as PipelineResult
}
