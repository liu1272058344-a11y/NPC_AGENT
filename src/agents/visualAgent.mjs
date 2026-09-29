import { randomUUID } from 'node:crypto'
import { createVisualAsset } from '../schemas/visualAsset.mjs'

export function buildVisualAsset(character) {
  const profile = character?.profile || {}
  const visual = character?.visual || {}
  const subject = String(profile.name || character?.name || '').trim()
  if (!subject) throw Object.assign(new Error('Character name is required for visual generation'), { code: 'INVALID_VISUAL_ASSET' })
  return createVisualAsset({
    visual_asset_id: `va-${randomUUID()}`,
    source_character_id: String(character.character_id || character.id || '').trim() || 'unknown-character',
    subject,
    appearance: String(visual.appearance || profile.background || character?.background || character?.role || 'distinctive character appearance').trim(),
    costume: String(visual.costume || (character?.role ? `${character.role} attire` : 'game character attire')).trim(),
    weapon: String(visual.weapon || 'signature equipment').trim(),
    environment: String(visual.environment || character?.world || 'game world environment').trim(),
    lighting: String(visual.lighting || 'cinematic key light').trim(),
    camera: String(visual.camera || 'full body three-quarter view').trim(),
    art_style: String(visual.art_style || 'game concept art').trim(),
    prompt: subject,
    negative_prompt: 'blurry, low quality, distorted anatomy',
    status: 'draft'
  })
}
