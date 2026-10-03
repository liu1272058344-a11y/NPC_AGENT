import type { ContentCategory } from './categories.mjs'
export interface ContentProfile { id:string; name:string; category:ContentCategory|'unknown'|'world'; worldId:string; revision:number; entityKind?:string; fields:Record<string,string>; visualBrief:string; fieldStatus:Record<string,'confirmed'|'pending'|'override'>; relatedIds:string[] }
export function normalizeContentProfile(value:unknown):ContentProfile
