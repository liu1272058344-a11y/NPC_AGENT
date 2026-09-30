export interface ImageProviderDefaults {
  endpoint: string
  modelId: string
}

export function getImageProviderDefaults(provider: string): ImageProviderDefaults
export function resolveImageModelId(provider: string, storedModelId: string | null | undefined): string

