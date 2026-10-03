import { classifyLegacyAsset } from './categories.mjs'
export function normalizeContentProfile(value = {}) {
 const profile = value.profile || value
 const fields = { ...(profile.design?.fields || profile.fields || {}) }
 if (profile.background && !fields.background) fields.background = profile.background
 return { ...profile, id: value.id || profile.id, name: value.name || profile.name || '', category: classifyLegacyAsset(value), worldId: profile.worldId || '', revision: Number.isInteger(profile.revision) && profile.revision > 0 ? profile.revision : 1, fields, visualBrief: profile.visualBrief || '', fieldStatus: { ...profile.fieldStatus }, relatedIds: profile.relatedIds || [] }
}
