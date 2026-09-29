export function buildPrompt(visualAsset) {
  const asset = visualAsset || {}
  const sections = {
    subject: asset.subject || '', appearance: asset.appearance || '', costume: asset.costume || '', weapon: asset.weapon || '',
    environment: asset.environment || '', lighting: asset.lighting || '', camera: asset.camera || '', art_style: asset.art_style || ''
  }
  const prompt = Object.entries(sections).map(([key, value]) => `${key}: ${value}`).join(', ')
  return { ...asset, ...sections, prompt }
}
