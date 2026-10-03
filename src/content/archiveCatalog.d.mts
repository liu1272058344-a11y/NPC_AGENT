import type {ContentWorld,RemoteArchiveSummary,RemotePromptRecord,RemoteImageAsset,createAssetApi} from '../agent/assetApi.mjs'
import type {ConversationSession} from './conversationSession.mjs'
export type ArchiveFilters={query?:string;category?:string;worldId?:string;status?:string}
export type CatalogContent=RemoteArchiveSummary&{category:string;state:string}
export type CatalogImage=RemoteImageAsset&{archive:RemoteArchiveSummary;prompt?:RemotePromptRecord}
export function isIndependentImage(row:RemoteArchiveSummary):boolean
export function archiveCatalog(input:{archives:RemoteArchiveSummary[];worlds:ContentWorld[];sessions:Record<string,ConversationSession>;filters?:ArchiveFilters}):{contents:CatalogContent[];counts:Record<string,number>;drafts:(ConversationSession&{label:string})[];independent:RemoteArchiveSummary[];unorganized:RemoteArchiveSummary[]}
export function loadArchiveImages(archives:RemoteArchiveSummary[],api:Pick<ReturnType<typeof createAssetApi>,'getRemoteArchive'>):Promise<{images:CatalogImage[];errors:{id:string;message:string}[]}>
