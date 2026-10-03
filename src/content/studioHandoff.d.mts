import type {ImageArchiveTarget} from './imageRequest.mjs'
export interface StudioHandoff {id:string;prompt:string;negativePrompt:string;source:Record<string,unknown>|null;target:ImageArchiveTarget|null;mode:'generated'|'edited'|'manual'}
export interface StudioInputState {consumedId?:string;pending?:StudioHandoff|null;prompt:string;negativePrompt?:string;source?:Record<string,unknown>|null;target?:ImageArchiveTarget|null;dirty?:boolean;hasUnsavedImage?:boolean}
export function createStudioHandoff(input:{prompt:string;negativePrompt?:string;source?:Record<string,unknown>|null;target?:ImageArchiveTarget|null;mode?:StudioHandoff['mode']},idFactory?:()=>string):StudioHandoff
export function receiveStudioHandoff(state:StudioInputState,incoming?:StudioHandoff|null,decision?:'replace'|'cancel'):{state:StudioInputState;needsDecision:boolean}
