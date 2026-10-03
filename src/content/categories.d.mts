export type ContentCategory = 'character' | 'map' | 'scene' | 'prop' | 'clothing'
export type LibraryCategory = ContentCategory | 'world' | 'unknown'
export const contentCategories: Record<ContentCategory, { label:string; fields:Record<string,string>; focus:string }>
export function categoryLabel(category:string):string
export function libraryCategoryLabel(category:string):string
export function classifyLegacyAsset(record:Record<string,unknown>):LibraryCategory
