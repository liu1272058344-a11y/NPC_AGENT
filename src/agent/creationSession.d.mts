import type { NPC, WorldProfile } from '../types/npc'

export type CreationKind = 'world' | 'character'
export type SaveState = 'unsaved' | 'saved' | 'dirty'
export interface WorldDraft { kind: 'world'; id: string; value: WorldProfile | null; saveState: SaveState; updatedAt: string | null }
export interface CharacterDraft { kind: 'character'; id: string; value: NPC | null; worldId: string; worldSnapshot: WorldProfile | null; saveState: SaveState; updatedAt: string | null }
export interface CreationSession { activeKind: CreationKind; world: WorldDraft; character: CharacterDraft | null }

export function createWorldDraft(idFactory?: () => string): WorldDraft
export function createCharacterDraft(idFactory?: () => string, world?: WorldProfile | null): CharacterDraft
export function copyDraftAsNew<T extends WorldDraft | CharacterDraft>(draft: T, idFactory?: () => string): T
export function applyWorldResult(session: CreationSession, world: WorldProfile): CreationSession
export function applyCharacterResult(session: CreationSession, npc: NPC): CreationSession
export function markDraftSaved<T extends WorldDraft | CharacterDraft>(draft: T, updatedAt: string): T
export function switchCreationKind(session: CreationSession, activeKind: CreationKind): CreationSession
