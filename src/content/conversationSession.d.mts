import type {ContentCategory} from './categories.mjs'
import type {ArtAssetPrompt,WorldProfile} from '../types/npc'
import type {ContentContext} from './context.mjs'
import type {RemoteArchiveDetail} from '../agent/assetApi.mjs'
import type {StudioHandoff} from './studioHandoff.mjs'
export interface ConversationMessage {id:string;role:'user'|'assistant';content:string}
export interface ContentDesign {name:string;summary:string;fields:Record<string,string>}
export interface ConversationResult {status?:string;question?:string;options?:string[];suggestions?:string[];assistantMessage?:string;world?:WorldProfile;design?:ContentDesign;asset?:ArtAssetPrompt;context?:ContentContext;category?:string;itemId?:string}
export interface ConversationSession {id:string;kind:'world'|ContentCategory|'unknown';worldId:string;worldSnapshot?:WorldProfile;worldValue?:WorldProfile;messages:ConversationMessage[];input:string;name:string;revision:number;design?:ContentDesign;asset?:ArtAssetPrompt;context?:ContentContext;status:'draft'|'saved'|'dirty';pendingRequest?:{id:string;messageId:string};failedMessageId?:string;error?:string;options?:string[];originalProfile?:Record<string,unknown>;promptSnapshot?:Record<string,unknown>;promptId?:string;promptMode?:'generated'|'edited'|'manual';promptProvider?:string;promptModel?:string;tags?:string[];visualBrief?:string;overrides?:Record<string,string>;updatedAt:string}
export const conversationStorageKey:string
export function createConversationSession(kind?:ConversationSession['kind'],world?:WorldProfile|null,idFactory?:()=>string):ConversationSession
export function beginConversationTurn(session:ConversationSession,text:string,requestId:string):ConversationSession
export function retryConversationTurn(session:ConversationSession,requestId:string):ConversationSession
export function completeConversationTurn(session:ConversationSession,requestId:string,result:ConversationResult):ConversationSession
export function failConversationTurn(session:ConversationSession,requestId:string,error:string):ConversationSession
export function restoreConversationSessions(values:Record<string,ConversationSession>):Record<string,ConversationSession>
export function sessionFromArchive(detail:RemoteArchiveDetail):ConversationSession
export function sessionFromLegacyDraft(draft:Record<string,unknown>):ConversationSession
export function conversationArchivePayload(session:ConversationSession):{world?:{id:string;name:string;profile:Record<string,unknown>};archive?:{id:string;name:string;summary:string;profile:Record<string,unknown>};prompts?:Record<string,unknown>[]}
export function editConversationSession(session:ConversationSession,patch:Partial<ConversationSession>,idFactory?:()=>string):ConversationSession
export function conversationImageHandoff(session:ConversationSession,language?:'zh'|'en'):StudioHandoff
export function conversationReply(result:ConversationResult):string
