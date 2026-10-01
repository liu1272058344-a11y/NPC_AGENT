export function saveCredential(provider: string, key: string, fetchImpl?: typeof fetch): Promise<boolean>
export function loadCredentialStatus(fetchImpl?: typeof fetch): Promise<string[]>
