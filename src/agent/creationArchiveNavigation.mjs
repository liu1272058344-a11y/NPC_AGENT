const worldFields=['name','genre','era','atmosphere','coreRule','centralConflict','summary','visualDirection','revision']
const npcFields=['name','role','world','function','summary','background','goal','speechStyle','sourcePrompt','personality','behaviorRules']
const pick=(source,fields)=>Object.fromEntries(fields.filter(key=>source[key]!==undefined).map(key=>[key,source[key]]))

export const creationSelectionFromWorld = record => ({ kind:'world',world:{...pick(record.profile || {},worldFields),id:record.id,name:record.name || record.profile?.name},npc:null })

export const creationSelectionFromCharacter = detail => {
  const profile=detail.archive.profile || {}
  const snapshot=profile.worldId && profile.world && typeof profile.world === 'object' ? {...pick(profile.world,worldFields),id:profile.worldId} : null
  return {kind:'character',world:snapshot,npc:{...pick(profile,npcFields),id:detail.archive.id,name:detail.archive.name || profile.name}}
}
