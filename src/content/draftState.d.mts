export function validateDraftName(name:string):{valid:boolean;message:string}
export function draftLabel(draft:{name:string;category:string;saved?:boolean;dirty?:boolean}):string
export function transitionDraft<T extends {id:string;dirty?:boolean;savedSnapshot?:unknown}>(state:{selected:string;drafts:Record<string,T>},action:{targetId:string;decision?:'keep'|'discard'|'cancel'}):{state:{selected:string;drafts:Record<string,T>};needsDecision:boolean}
