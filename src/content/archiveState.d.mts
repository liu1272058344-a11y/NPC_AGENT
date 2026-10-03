import type { ContentWorld, RemoteArchiveSummary, RemotePromptRecord } from '../agent/assetApi.mjs'
import type { ArtAssetPrompt } from '../types/npc'
import type { ContentContext } from './context.mjs'
import type { ContentProfile } from './profile.mjs'
export function creationEditorFor(archive:RemoteArchiveSummary):'world'|'character'|null
export function resolveContentWorld(worlds:ContentWorld[],item:{worldId:string}):ContentWorld|undefined
export function resumePromptData(record?:RemotePromptRecord):{context?:ContentContext;design?:{name:string;summary:string;fields:Record<string,string>};asset?:ArtAssetPrompt;mode:'manual'|'generated'|'edited'}
export function readArchiveProfile(archive:RemoteArchiveSummary):ContentProfile
