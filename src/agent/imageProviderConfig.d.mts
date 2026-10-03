export interface ImageProviderDefaults {
  endpoint: string
  modelId: string
}

export interface ImageModelOption {
  value: string
  label: string
}

export function getImageProviderDefaults(provider: string): ImageProviderDefaults
export function getImageModelOptions(provider: string): ImageModelOption[]
export function resolveImageModelId(provider: string, storedModelId: string | null | undefined): string

