export interface MigrationResult { migrated: number; expired: number; pending: number }
export function migrateLocalAssetRecords(storage: Storage, api: { saveRemoteImage(input: Record<string, unknown>): Promise<unknown> }): Promise<MigrationResult>
