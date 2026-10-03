export function draftCatalog<T extends {id:string;name?:string;requirements?:string;fields?:Record<string,string>;asset?:unknown;design?:unknown}>(drafts:Record<string,T>):{named:T[];recoverable:T[]}
