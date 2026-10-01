export async function runDeployPipeline(input = {}) {
  const requirement = String(input.requirement || '').trim()
  if (!requirement) throw new Error('requirement is required')
  const style = String(input.style || '').trim()
  const assetType = String(input.assetType || 'character').trim() || 'character'
  const projectId = 'project-draft'
  const characterId = 'character-draft'
  const worldName = 'Generated World'
  const characterName = 'Generated Character'
  const visualPrompt = `${characterName}, ${requirement.slice(0, 60)}; environment: ${worldName}; world: ${requirement}; style: ${style || 'game concept art'}`
  const character = {
    character_id: characterId,
    profile: { name: characterName, role: requirement.slice(0, 60), background: `Lives in ${worldName}.`, personality: ['driven', 'guarded'] },
    visual: { appearance: '', costume: '', weapon: '', environment: worldName }
  }
  return {
    project: {
      project_id: projectId,
      name: requirement.slice(0, 60),
      genre: '',
      style,
      world: { name: worldName, genre: requirement.slice(0, 40), style, summary: requirement, atmosphere: '', core_rule: '', central_conflict: '' },
      characters: [character],
      assets: [{ asset_id: `${characterId}-asset-v1`, type: assetType, source_id: characterId, prompt: visualPrompt, url: '', version: 1, status: 'draft' }]
    },
    visual: { visual_prompt: visualPrompt, negative_prompt: 'blurry, low quality, inconsistent anatomy', style_tags: ['game concept art'], camera: '', lighting: '', subject: characterName, appearance: '', costume: '', weapon: '', environment: worldName, art_style: style || 'cinematic game art' }
  }
}
