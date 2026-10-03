export interface ImageRequestSnapshot { requestId:string;prompt:string;negativePrompt:string;provider:string;model:string;parameters:Record<string,string>;source:Record<string,unknown>|null;mode:'generated'|'edited'|'manual' }
export interface ImageArchiveTarget {id:string;name:string;summary?:string;profile:Record<string,unknown>}
export function captureImageRequest(input:{prompt:string;negativePrompt?:string;provider:string;model:string;parameters?:Record<string,string>;source?:Record<string,unknown>|null;mode?:ImageRequestSnapshot['mode']},idFactory?:()=>string):ImageRequestSnapshot
export function imageSavePayload(result:{image:{url:string;size?:string};requestSnapshot:ImageRequestSnapshot},target?:ImageArchiveTarget|null,name?:string):Record<string,unknown>
