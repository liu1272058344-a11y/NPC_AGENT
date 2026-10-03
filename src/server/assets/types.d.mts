export interface WorkspaceUsage { imageCount: number; byteCount: number }
export interface ImageAsset { id: string; archiveId: string; url: string; pathname: string; contentType: string; byteSize: number; width?: number; height?: number; provider: string; modelId: string; createdAt: string; expiresAt: string }
export interface PromptRecord { id: string; prompt: string; negativePrompt: string; provider: string; modelId: string; createdAt: string }
export interface ArchiveSummary { id: string; name: string; summary: string; imageCount: number; byteCount: number; coverUrl?: string; nearestExpiry?: string }
export interface ArchiveDetail { archive: Record<string, unknown>; prompts: PromptRecord[]; images: ImageAsset[] }
export interface WorldArchive { id: string; name: string; profile: Record<string, unknown>; updatedAt?: string }
export type AssetApiResponse<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }
