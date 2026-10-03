import type {ConversationSession} from './conversationSession.mjs'
import type {PipelineResult} from '../agent/pipeline'
export function readBuilderSessions(storage:Storage,idFactory?:()=>string):Record<string,ConversationSession>
export function pipelineSessions(result:PipelineResult,idFactory?:()=>string):ConversationSession[]
