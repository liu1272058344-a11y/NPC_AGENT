import type { RemoteArchiveSummary } from './assetApi.mjs'
export function buildContentLibrary(archives:RemoteArchiveSummary[],filters?:{worldId?:string;category?:string;query?:string;status?:string}):{items:(RemoteArchiveSummary & {state:string})[];counts:Record<string,number>}
export function applyGenerationResult<T>(state:Record<string,T>,request:{itemId:string;requestId:string},result:Partial<T>):Record<string,T>
