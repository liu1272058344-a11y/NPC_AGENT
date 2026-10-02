export type ContentCategory = 'character' | 'map' | 'scene' | 'prop'
export const contentCategories: Record<ContentCategory, { label:string; fields:Record<string,string>; focus:string }>
export function categoryLabel(category:string):string
export function classifyLegacyAsset(record:Record<string,unknown>):ContentCategory | 'unknown'
