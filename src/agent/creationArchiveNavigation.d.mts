import type { NPC, WorldProfile } from '../types/npc'
import type { ContentWorld, RemoteArchiveDetail } from './assetApi.mjs'
export interface CreationArchiveSelection { kind:'world'|'character';world:WorldProfile|null;npc:NPC|null }
export function creationSelectionFromWorld(record:ContentWorld):CreationArchiveSelection
export function creationSelectionFromCharacter(detail:RemoteArchiveDetail):CreationArchiveSelection
