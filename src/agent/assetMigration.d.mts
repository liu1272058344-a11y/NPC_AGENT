export interface MigrationResult { migrated: number; expired: number; pending: number; migratedArchives: number }
export function migrateLocalAssetRecords(storage: Storage, api: { saveRemoteArchive(input: Record<string, unknown>): Promise<unknown>; saveRemoteImage(input: Record<string, unknown>): Promise<unknown> }): Promise<MigrationResult>
