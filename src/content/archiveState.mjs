import { normalizeContentProfile } from './profile.mjs'
export function creationEditorFor(archive) {
 if(archive.category === 'world')return 'world'
 const p=archive.profile || {}
 return archive.category === 'character' && !p.design?.fields && Array.isArray(p.personality) && Array.isArray(p.behaviorRules) ? 'character' : null
}
export const resolveContentWorld=(worlds,item)=>worlds.find(world=>world.id===item.worldId)
export function resumePromptData(record) {
 const snapshot=record?.snapshot || {},source=snapshot.source || {}
 const originalAsset=snapshot.asset || source.asset
 const asset=originalAsset?{...originalAsset,promptEn:record.prompt,negativePrompt:record.negativePrompt || '',promptZh:record.promptZh || ''}:undefined
 return {context:snapshot.context || source.context,design:snapshot.design || source.design,asset,mode:snapshot.mode || 'manual'}
}
export const readArchiveProfile = archive => normalizeContentProfile(archive)
