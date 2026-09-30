# Remote Image Asset Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist generated images in remote object storage for 30 days, enforce per-workspace quotas, and provide reliable archive tabs, image viewing, downloading, and deletion.

**Architecture:** Vercel Functions expose a workspace-scoped asset API backed by Neon Postgres and Vercel Blob. The React client keeps only an anonymous workspace ID and transient form state locally; remote metadata drives archive lists and details. A daily Vercel Cron removes expired objects and records through an idempotent cleanup service.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vercel Functions, `@vercel/blob`, `@neondatabase/serverless`, Node test runner, CSS

**Spec:** `docs/superpowers/specs/2026-09-30-remote-image-asset-library-design.md`

## Global Constraints

- Store image bytes only in Vercel Blob; never persist image Base64 or binary data in browser storage, the Git repository, or server local disk.
- Store archive metadata in Neon Postgres as the source of truth.
- Keep at most 20 images and 100 MB per anonymous workspace.
- Set `expiresAt` to exactly 30 days after the server-side save time; viewing and downloading do not extend it.
- Show a warning at 80% of either quota and always show that saved images are temporary.
- Keep provider keys, `BLOB_READ_WRITE_TOKEN`, database credentials, and `CRON_SECRET` server-side or in session storage according to their existing roles.
- Every data query and mutation must scope records by `workspaceId`.
- Preserve the generated image and prompt in the UI when saving fails.
- Reject unsafe source URLs, non-image MIME types, oversized responses, and private-network destinations.
- Do not add account, billing, sharing, permanent retention, or cross-browser recovery in this implementation.

## Review Focus

- Two concurrent saves near the 20-image or 100 MB limit must not both pass and exceed quota; Task 3 adds a transaction/concurrency test.
- A valid-looking source URL that resolves or redirects to localhost, RFC1918, link-local, or cloud metadata addresses must be rejected; Task 2 tests initial and redirected targets.
- A Blob upload followed by a database failure must delete the orphaned Blob; Task 3 tests the compensation path.
- A cleanup retry after partial deletion or duplicate Cron delivery must complete without corrupting unrelated records; Task 5 tests idempotency.
- A stale browser workspace ID or unavailable database must show a retryable error rather than an empty asset library; Task 6 tests UI state mapping.

---

## File Structure

- `db/migrations/001_remote_asset_library.sql`: Neon schema, constraints, and indexes.
- `src/server/assets/types.ts`: Shared server domain and API response types.
- `src/server/assets/config.ts`: Exact quota, retention, download, and source-fetch limits.
- `src/server/assets/database.ts`: Parameterized Neon queries and transaction boundary.
- `src/server/assets/sourceImage.ts`: Safe remote image retrieval and metadata validation.
- `src/server/assets/blobStore.ts`: Vercel Blob upload and deletion adapter.
- `src/server/assets/assetService.ts`: Save, list, detail, delete, quota, and cleanup orchestration.
- `src/server/assets/http.ts`: Workspace/header validation and uniform HTTP responses.
- `api/assets/index.ts`: Asset archive list and optional detail endpoint.
- `api/assets/images/index.ts`: Save generated image endpoint.
- `api/assets/images/[id]/download.ts`: Workspace-checked download endpoint.
- `api/assets/images/[id]/index.ts`: Image delete endpoint.
- `api/cron/assets-cleanup.ts`: Protected scheduled cleanup endpoint.
- `src/agent/assetApi.ts`: Typed browser API client and workspace identity helper.
- `src/agent/assetLibraryView.mjs`: Remote archive view-model builders and quota presentation.
- `src/agent/assetLibraryView.d.mts`: View-model declarations.
- `src/components/ImageViewer.tsx`: Modal zoom, pan, reset, keyboard, and download UI.
- `src/components/ArchiveDetail.tsx`: Three-tab archive detail UI.
- `src/App.tsx`: Remote loading/saving state and integration with existing screens.
- `src/App.css`: Asset quota, tabs, gallery, and viewer styles.
- `vercel.json`: Daily cleanup schedule while preserving the existing build configuration and fallback.
- `.env.example`: Required Blob, Neon, and Cron variables.
- `tests/asset-source-image.test.mjs`: URL and remote response validation.
- `tests/asset-service.test.mjs`: Quotas, compensation, ownership, deletion, and cleanup.
- `tests/asset-api-client.test.mjs`: Browser request contract and error mapping.
- `tests/image-viewer-state.test.mjs`: Pure zoom and pan state behavior.
- `tests/asset-library-view.test.mjs`: Remote archive grouping, tabs, and quota copy.

### Task 1: Define the remote asset domain and database schema

**Files:**
- Create: `db/migrations/001_remote_asset_library.sql`
- Create: `src/server/assets/types.ts`
- Create: `src/server/assets/config.ts`
- Create: `src/server/assets/database.ts`
- Create: `tests/asset-database.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `AssetDatabase` with `ensureWorkspace`, `upsertArchive`, `getWorkspaceUsage`, `insertImageAsset`, `listArchives`, `getArchiveDetail`, `findImageAsset`, `deleteImageRecord`, and `listExpiredImages`.
- Produces: `ASSET_LIMITS = { maxImages: 20, maxBytes: 104857600, retentionDays: 30, warningRatio: 0.8 }`.
- Produces: `AssetApiResponse<T>`, `ArchiveSummary`, `ArchiveDetail`, `ImageAsset`, `PromptRecord`, and `WorkspaceUsage` types.

- [ ] **Step 1: Add failing database contract tests**

Test exact schema names, parameterized workspace filters, 20/100 MB constants, 30-day retention, and an atomic `reserve usage -> insert` transaction interface using a fake query adapter.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/asset-database.test.mjs`

Expected: FAIL because the asset database modules do not exist.

- [ ] **Step 3: Add Neon and Blob dependencies**

Run: `npm install @neondatabase/serverless @vercel/blob`

Expected: `package.json` and `package-lock.json` record both production dependencies.

- [ ] **Step 4: Implement schema, types, constants, and database adapter**

Define `workspaces`, `npc_archives`, `prompt_records`, and `image_assets`; add foreign keys and indexes for `(workspace_id, expires_at)` and archive relations. The adapter accepts an injected SQL executor in tests and uses `DATABASE_URL` in production.

- [ ] **Step 5: Run the focused test**

Run: `node --test tests/asset-database.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/001_remote_asset_library.sql src/server/assets/types.ts src/server/assets/config.ts src/server/assets/database.ts tests/asset-database.test.mjs package.json package-lock.json
git commit -m "feat: add remote asset database model"
```

### Task 2: Validate and fetch generated image sources safely

**Files:**
- Create: `src/server/assets/sourceImage.ts`
- Create: `tests/asset-source-image.test.mjs`

**Interfaces:**
- Consumes: limits from `src/server/assets/config.ts`.
- Produces: `fetchSourceImage(sourceUrl: string, dependencies?: SourceImageDependencies): Promise<{ bytes: Uint8Array; contentType: string; byteSize: number; width?: number; height?: number }>`.
- Produces: `validatePublicImageUrl(url: URL, resolveHost: ResolveHost): Promise<void>`.

- [ ] **Step 1: Write failing validation tests**

Cover `http`/`https`, credentials in URL, loopback, IPv4/IPv6 private and link-local ranges, `169.254.169.254`, DNS results that resolve privately, redirects to private targets, timeout, body larger than the configured per-file limit, and non-image MIME types.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/asset-source-image.test.mjs`

Expected: FAIL because `sourceImage.ts` does not exist.

- [ ] **Step 3: Implement URL validation and bounded image fetch**

Use an abort timeout, manual redirect validation, bounded streaming reads, a strict image MIME allowlist, and DNS resolution before each request target. Do not trust `Content-Length` as the only size check.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/asset-source-image.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/assets/sourceImage.ts tests/asset-source-image.test.mjs
git commit -m "feat: validate remote image sources"
```

### Task 3: Implement asset storage and quota orchestration

**Files:**
- Create: `src/server/assets/blobStore.ts`
- Create: `src/server/assets/assetService.ts`
- Create: `tests/asset-service.test.mjs`

**Interfaces:**
- Consumes: `AssetDatabase`, `fetchSourceImage`, `ASSET_LIMITS`.
- Produces: `BlobStore` with `putImage(pathname, bytes, contentType)` and `deleteImage(urlOrPathname)`.
- Produces: `createAssetService(dependencies)` with `saveGeneratedImage`, `listArchiveSummaries`, `getArchiveDetail`, `deleteImage`, and `cleanupExpiredImages`.
- `saveGeneratedImage(input)` accepts `workspaceId`, archive snapshot, Prompt snapshot, source URL, provider, model ID, and optional dimensions; it returns the saved asset plus current usage.

- [ ] **Step 1: Write failing service tests**

Assert successful save, duplicate idempotency key handling, exact 20-image rejection, exact 100 MB rejection, simultaneous reservations near both limits, 80% warning state, 30-day expiry, workspace ownership, and Blob cleanup after database failure.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/asset-service.test.mjs`

Expected: FAIL because the service and Blob adapter do not exist.

- [ ] **Step 3: Implement the Blob adapter and service**

Use random object paths, `addRandomSuffix`, server timestamps, database locking or serializable retry for quota enforcement, and compensating Blob deletion when metadata insertion fails.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/asset-service.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/assets/blobStore.ts src/server/assets/assetService.ts tests/asset-service.test.mjs
git commit -m "feat: store generated image assets remotely"
```

### Task 4: Expose workspace-scoped asset APIs

**Files:**
- Create: `src/server/assets/http.ts`
- Create: `api/assets/index.ts`
- Create: `api/assets/images/index.ts`
- Create: `api/assets/images/[id]/download.ts`
- Create: `api/assets/images/[id]/index.ts`
- Create: `tests/remote-asset-api.test.mjs`

**Interfaces:**
- Consumes: `createAssetService(dependencies)` from Task 3.
- Produces: JSON envelope `{ ok: true, data } | { ok: false, error: { code, message } }`.
- Consumes workspace identity from `X-Workspace-Id`; validates it as a UUID before service calls.
- `GET /api/assets?archiveId=<id>` returns summaries without `archiveId`, and one `ArchiveDetail` with it.
- `POST /api/assets/images` accepts an idempotency key plus archive, Prompt, model, and source URL data.

- [ ] **Step 1: Write failing handler tests**

Exercise missing/invalid workspace ID, list, detail, save, duplicate save, download filename sanitization, delete, unsupported methods, stable error codes, and access to another workspace's asset.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/remote-asset-api.test.mjs`

Expected: FAIL because the handlers do not exist.

- [ ] **Step 3: Implement shared HTTP helpers and handlers**

Keep transport validation in `http.ts`; keep quotas and persistence in the service. Download must validate ownership before redirecting or streaming and must emit a sanitized filename.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/remote-asset-api.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/assets/http.ts api/assets tests/remote-asset-api.test.mjs
git commit -m "feat: expose remote asset APIs"
```

### Task 5: Add idempotent expiration cleanup

**Files:**
- Create: `api/cron/assets-cleanup.ts`
- Modify: `src/server/assets/assetService.ts`
- Modify: `tests/asset-service.test.mjs`
- Create: `tests/asset-cleanup-api.test.mjs`
- Modify: `vercel.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `cleanupExpiredImages({ before, batchSize: 100 })` from the asset service.
- Produces: authenticated `GET /api/cron/assets-cleanup` and daily UTC Cron configuration.

- [ ] **Step 1: Add failing cleanup tests**

Assert missing/wrong `CRON_SECRET` rejection, successful batch cleanup, missing Blob tolerance, partial failure reporting, retry safety, duplicate invocation safety, and preservation of nonexpired or other-workspace records.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `node --test tests/asset-service.test.mjs tests/asset-cleanup-api.test.mjs`

Expected: FAIL on cleanup behavior and missing handler.

- [ ] **Step 3: Implement cleanup and deployment configuration**

Delete each Blob before its metadata record, treat already-missing objects as success, and leave failed rows for the next run. Add one daily Cron entry and document `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, and `CRON_SECRET`.

- [ ] **Step 4: Run the focused tests**

Run: `node --test tests/asset-service.test.mjs tests/asset-cleanup-api.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/cron/assets-cleanup.ts src/server/assets/assetService.ts tests/asset-service.test.mjs tests/asset-cleanup-api.test.mjs vercel.json .env.example
git commit -m "feat: clean up expired image assets"
```

### Task 6: Replace local image records with the remote asset client

**Files:**
- Create: `src/agent/assetApi.ts`
- Create: `tests/asset-api-client.test.mjs`
- Modify: `src/agent/assetLibraryView.mjs`
- Modify: `src/agent/assetLibraryView.d.mts`
- Modify: `tests/asset-library-view.test.mjs`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: API contracts from Task 4.
- Produces: `getWorkspaceId(): string`, `listRemoteAssets()`, `getRemoteArchive(id)`, `saveRemoteImage(input)`, `deleteRemoteImage(id)`, and `getRemoteImageDownloadUrl(id)`.
- Produces: remote archive card/detail and quota view models with `isNearLimit`, `expiresLabel`, and loading/error states.

- [ ] **Step 1: Write failing client and view-model tests**

Assert stable UUID creation/reuse, no image bytes written to local storage, required workspace header, response-envelope parsing, localized quota/source/database errors, stale workspace or database failure shown as retryable error, grouping by archive, recent image cover, expiry copy, and 80% warning copy.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `node --test tests/asset-api-client.test.mjs tests/asset-library-view.test.mjs`

Expected: FAIL because the remote client and view models are absent.

- [ ] **Step 3: Implement the client and remote state integration**

Replace `npc-forge-image-library` reads/writes with server requests. Keep only `npc-forge-workspace-id` and transient nonimage state locally. Load assets on Asset Library entry, distinguish loading/error/empty states, retry failures, and update usage after save/delete without discarding the generated image on errors.

- [ ] **Step 4: Run the focused tests**

Run: `node --test tests/asset-api-client.test.mjs tests/asset-library-view.test.mjs`

Expected: PASS.

- [ ] **Step 5: Build the application**

Run: `npm run build`

Expected: TypeScript and Vite builds succeed.

- [ ] **Step 6: Commit**

```bash
git add src/agent/assetApi.ts src/agent/assetLibraryView.mjs src/agent/assetLibraryView.d.mts src/App.tsx tests/asset-api-client.test.mjs tests/asset-library-view.test.mjs
git commit -m "feat: load image assets from remote storage"
```

### Task 7: Add archive tabs and image viewer controls

**Files:**
- Create: `src/components/ImageViewer.tsx`
- Create: `src/components/ArchiveDetail.tsx`
- Create: `src/agent/imageViewerState.mjs`
- Create: `src/agent/imageViewerState.d.mts`
- Create: `tests/image-viewer-state.test.mjs`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `ArchiveDetail` and remote asset client from Task 6.
- Produces: `ImageViewer({ image, downloadUrl, onClose })`.
- Produces: `ArchiveDetailView({ archive, activeTab, onTabChange, onOpenImage, onDeleteImage })`.
- Produces: pure helpers `clampZoom`, `zoomAroundPoint`, `panWithinBounds`, and `resetViewport` with zoom range `0.5` to `5`.

- [ ] **Step 1: Write failing viewer-state tests**

Assert wheel/button zoom clamps from 0.5× to 5×, pointer-centered zoom, bounded drag, reset to 1×, and keyboard command mapping for Escape, plus, minus, and zero.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/image-viewer-state.test.mjs`

Expected: FAIL because viewer state helpers do not exist.

- [ ] **Step 3: Implement pure viewer state and React components**

Build an accessible modal with focusable controls and explicit close/download labels. Build `info`, `prompts`, and `images` tabs; synchronize `tab` in `URLSearchParams`; show distinct empty states and image expiry dates.

- [ ] **Step 4: Integrate components and styling**

Make generated results and archive thumbnails open the viewer. Add zoom, pan, reset, download, delete, quota meter, temporary-storage notice, responsive gallery, and keyboard behavior.

- [ ] **Step 5: Run focused tests and build**

Run: `node --test tests/image-viewer-state.test.mjs tests/asset-library-view.test.mjs && npm run build`

Expected: all tests pass and the production build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/ImageViewer.tsx src/components/ArchiveDetail.tsx src/agent/imageViewerState.mjs src/agent/imageViewerState.d.mts src/App.tsx src/App.css tests/image-viewer-state.test.mjs
git commit -m "feat: add archive tabs and image viewer"
```

### Task 8: Migrate recoverable local records and complete release verification

**Files:**
- Create: `src/agent/assetMigration.mjs`
- Create: `src/agent/assetMigration.d.mts`
- Create: `tests/asset-migration.test.mjs`
- Modify: `src/App.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 6 API client.
- Produces: `migrateLocalAssetRecords(storage, api): Promise<MigrationResult>` using a deterministic migration key and removing `npc-forge-image-library` only after each recoverable record is accepted or explicitly classified as expired.

- [ ] **Step 1: Write failing migration tests**

Assert idempotent NPC/Prompt migration, successful live-image upload, expired-source reporting, no duplicate records after retry, preservation after transient API failure, and final removal of the old image key only when migration is complete.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/asset-migration.test.mjs`

Expected: FAIL because the migration module does not exist.

- [ ] **Step 3: Implement one-time migration and user messaging**

Run migration after workspace initialization, show a concise result banner, and document storage setup, database migration, retention behavior, local development, and deployment variables in `README.md`.

- [ ] **Step 4: Run the complete verification suite**

Run: `node --test tests/*.test.mjs`

Expected: all JavaScript tests pass.

Run: `python -m unittest tests/pipeline_test.py`

Expected: Python pipeline tests pass.

Run: `npm run build`

Expected: TypeScript and Vite production build succeed.

Run: `npm run lint`

Expected: no new lint errors; any pre-existing warnings are documented.

- [ ] **Step 5: Perform production smoke verification after resources are connected**

Apply `db/migrations/001_remote_asset_library.sql`, connect Blob and Neon, set `CRON_SECRET`, deploy, then verify save, refresh, list, detail tabs, zoom, download, delete, quota rejection, and a manually authorized cleanup invocation. Do not report production completion unless each operation succeeds against the deployed URL.

- [ ] **Step 6: Commit**

```bash
git add src/agent/assetMigration.mjs src/agent/assetMigration.d.mts src/App.tsx tests/asset-migration.test.mjs README.md
git commit -m "feat: migrate and document remote asset storage"
```

