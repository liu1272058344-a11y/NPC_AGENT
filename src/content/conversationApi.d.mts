import type {ConversationSession,ConversationResult} from './conversationSession.mjs'
import type {WorldProfile} from '../types/npc'
export function requestConversationTurn(session:ConversationSession,options:{provider:string;model:string;world?:WorldProfile;requestId:string;signal?:AbortSignal;fetchImpl?:typeof fetch}):Promise<ConversationResult>
