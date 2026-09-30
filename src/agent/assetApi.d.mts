export interface RemoteUsage { imageCount: number; byteCount: number }
export interface RemoteImageAsset { id: string; archiveId: string; url: string; pathname: string; contentType: string; byteSize: number; width?: number; height?: number; provider: string; modelId: string; createdAt: string; expiresAt: string }
export interface RemotePromptRecord { id: string; prompt: string; negativePrompt: string; provider: string; modelId: string; createdAt: string }
export interface RemoteArchiveSummary { id: string; name: string; summary: string; imageCount: number; byteCount: number; coverUrl?: string; nearestExpiry?: string }
export interface RemoteArchiveDetail { archive: { id: string; name: string; summary: string; profile: Record<string, unknown> }; prompts: RemotePromptRecord[]; images: RemoteImageAsset[] }
export function getWorkspaceId(storage?: Storage, createId?: () => string): string
export function assetErrorMessage(code?: string, fallback?: string): string
export function createAssetApi(options?: { workspaceId?: string; fetchImpl?: typeof fetch }): { workspaceId: string; listRemoteAssets(): Promise<{ archives: RemoteArchiveSummary[]; usage: RemoteUsage }>; getRemoteArchive(id: string): Promise<RemoteArchiveDetail>; saveRemoteImage(input: Record<string, unknown>): Promise<{ asset: RemoteImageAsset; usage: RemoteUsage; nearLimit: boolean }>; saveRemoteArchive(input: Record<string, unknown>): Promise<{ archive: RemoteArchiveSummary }>; deleteRemoteImage(id: string): Promise<{ deleted: boolean }>; getRemoteImageDownloadUrl(id: string): string }
