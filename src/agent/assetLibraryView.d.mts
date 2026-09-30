import type { ArtAssetPrompt, NPC } from '../types/npc'

export type AssetLibraryEntry =
  | { id: string; kind: 'npc'; title: string; subtitle: string; detail: string }
  | { id: string; kind: 'prompt'; title: string; subtitle: string; detail: string; prompt: ArtAssetPrompt }

export function buildAssetLibraryEntries(npc: NPC | null, prompts: ArtAssetPrompt[]): AssetLibraryEntry[]
export type AssetLibraryDetail =
  | { kind: 'npc'; npc: NPC; prompts: ArtAssetPrompt[] }
  | { kind: 'prompt'; prompt: ArtAssetPrompt }

export function buildAssetLibraryDetail(entryId: string, npc: NPC | null, prompts: ArtAssetPrompt[]): AssetLibraryDetail | null
