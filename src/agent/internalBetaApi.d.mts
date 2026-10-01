export type BetaRole = 'tester' | 'admin' | null
export type BetaUsage = { imageCount: number; byteCount: number; dailyActions: number; limits: { maxImages: number; maxBytes: number; dailyActions: number } }
export function createInternalBetaApi(fetchImpl?: typeof fetch): {
  status(): Promise<{ authenticated: boolean; role: BetaRole }>
  login(password: string): Promise<{ authenticated: boolean; role: BetaRole }>
  logout(): Promise<void>
  usage(): Promise<BetaUsage>
}
