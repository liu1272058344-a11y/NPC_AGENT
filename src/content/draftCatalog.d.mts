export function draftCatalog<T extends {id:string;name?:string;requirements?:string;fields?:Record<string,string>;asset?:unknown;design?:unknown}>(drafts:Record<string,T>):{named:T[];recoverable:T[]}
export function existingDesignDraft<T>(drafts:Record<string,T>,id:string):T|undefined
