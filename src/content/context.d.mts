export interface ContentContext { source:{worldId:string;worldRevision:number|null;itemId:string;itemRevision:number;unavailable:boolean}; confirmed:{world:Record<string,unknown>|null;fields:Record<string,string>;visualBrief:string;visualDirection:string;[key:string]:unknown}; pending:string[];conflicts:Array<{field:string;inherited:unknown;override:unknown}> }
export function buildContentContext(input:{world?:unknown;item?:unknown;overrides?:Record<string,string>}):ContentContext
export function isPromptStale(snapshot:unknown,world:unknown,item:unknown):boolean
