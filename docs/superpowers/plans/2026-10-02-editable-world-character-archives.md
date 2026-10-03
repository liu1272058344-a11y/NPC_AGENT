# Editable World and Character Archives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the forced world-to-character wizard with independently saved, repeatedly editable world and character archives whose identity is stable across revisions.

**Architecture:** Keep `content_worlds` as the source of truth for world archives and `npc_archives` as the source of truth for character archives, exposed through the existing asset API. Add a pure creation-session state module and a focused React workspace so generation results update drafts without changing the active content type; navigation happens only through explicit user actions.

**Tech Stack:** React 19, TypeScript 6, Node.js ES modules, Vercel API handlers, Neon PostgreSQL JSONB, Zod, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-02-editable-world-character-archives-design.md`

## Global Constraints

- A stable UUID, not a name, determines archive identity.
- Saving the same archive ID overwrites its latest content and does not create history.
- New and Save As actions always create a new ID, even when names match.
- Agent completion never changes the active world/character workspace.
- World deletion never deletes characters; it removes their `worldId` while preserving their embedded world snapshot.
- Existing `npc-forge-*` browser keys must not be renamed or cleared outside the existing migration rules.
- Existing prompt, image, credential, internal-beta, quota, and image-quality behavior must remain unchanged.
- No new runtime dependency is required.

## Review Focus

- Two archives with the same name but different IDs must remain distinct; covered by Task 2 service tests and Task 6 UI tests.
- A failed revision request must preserve the current draft and dirty state; covered by Task 3 contract tests and Task 5 interaction tests.
- Deleting a world with multiple characters must detach every character without changing its snapshot; covered by Task 2 database/service tests.
- Refreshing after a successful save must reopen the same ID instead of creating a duplicate; covered by Task 4 client tests and Task 6 integration tests.
- Legacy characters without `worldId` and legacy worlds without stable IDs must remain openable; covered by Task 7 migration tests.

---

### Task 1: Creation Session State and Archive Identity

**Files:**
- Create: `src/agent/creationSession.mjs`
- Create: `src/agent/creationSession.d.mts`
- Create: `tests/creation-session.test.mjs`
- Modify: `src/types/npc.ts`

**Interfaces:**
- Produces: `createWorldDraft(idFactory)`, `createCharacterDraft(idFactory, world?)`, `copyDraftAsNew(draft, idFactory)`, `applyWorldResult(session, world)`, `applyCharacterResult(session, npc)`, `markDraftSaved(session, updatedAt)`, and `switchCreationKind(session, kind)`.
- Produces: `CreationKind = 'world' | 'character'`, `SaveState = 'unsaved' | 'saved' | 'dirty'`, and `CreationSession` containing active kind, stable IDs, current drafts, save state, and explicit world linkage.
- Consumes: existing `WorldProfile` and `NPC` shapes from `src/types/npc.ts`.

- [ ] **Step 1: Write failing identity and state-transition tests**

Add tests named:

- `revision preserves the world archive id and marks it dirty`
- `save as copies content under a different id`
- `generation results never switch the active creation kind`
- `returning to world preserves the current character draft`

Use deterministic ID factories and assert literal IDs (`world-1`, `world-2`, `character-1`).

- [ ] **Step 2: Run the state tests and verify RED**

Run: `node --test tests/creation-session.test.mjs`

Expected: FAIL because `creationSession.mjs` does not exist.

- [ ] **Step 3: Implement the typed pure state API**

Use immutable return values. `apply*Result` must retain the current archive ID, replace only the corresponding content, set `saveState: 'dirty'`, and leave `activeKind` unchanged. `copyDraftAsNew` must preserve content but replace the ID and set `saveState: 'unsaved'`.

- [ ] **Step 4: Run the state tests and verify GREEN**

Run: `node --test tests/creation-session.test.mjs`

Expected: all Task 1 tests pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/agent/creationSession.mjs src/agent/creationSession.d.mts src/types/npc.ts tests/creation-session.test.mjs
git commit -m "feat: add editable creation session state"
```

### Task 2: Persistent World and Character Archive Semantics

**Files:**
- Modify: `src/server/assets/database.mjs`
- Modify: `src/server/assets/assetService.mjs`
- Modify: `src/server/assets/types.d.mts`
- Modify: `tests/asset-database.test.mjs`
- Modify: `tests/asset-service.test.mjs`
- Modify: `tests/archive-delete.test.mjs`
- Modify: `tests/content-archive.test.mjs`

**Interfaces:**
- Consumes: stable world and character IDs from Task 1.
- Produces: `saveWorld(workspaceId, { id, name, profile })`, `getWorld(workspaceId, id)`, `listWorlds(workspaceId)`, and `deleteWorld(workspaceId, id)`.
- Produces: character archives with `profile.category === 'character'`, optional `profile.worldId`, and preserved `profile.world` snapshot.
- Produces: `deleteWorld` result `{ deleted: true, detachedCharacterCount: number }`.

- [ ] **Step 1: Write failing database boundary tests**

Assert that:

- saving the same `(workspaceId, id)` twice uses upsert and returns the second profile;
- same-name worlds with different IDs remain separate;
- deleting a world executes a workspace-scoped JSONB update removing `worldId` from linked character profiles before deleting the world;
- the update leaves `profile.world` untouched.

- [ ] **Step 2: Run database tests and verify RED**

Run: `node --test tests/asset-database.test.mjs tests/archive-delete.test.mjs`

Expected: FAIL on missing world detail/delete operations and detach behavior.

- [ ] **Step 3: Implement world persistence operations**

Extend `listWorlds` to return `id`, `name`, `profile`, and `updatedAt`; expose `findWorld` as the service detail lookup. Implement a workspace-scoped delete operation that detaches linked character profiles and deletes the world as one SQL statement/CTE so partial deletion cannot occur.

- [ ] **Step 4: Write failing service contract tests**

Assert that:

- `saveWorld` validates a complete ID and name;
- `saveArchive` updates a character with the same ID rather than creating another record;
- a linked character must reference an existing world;
- an unlinked legacy character remains valid;
- `deleteWorld` reports the number of detached characters and is idempotent.

- [ ] **Step 5: Implement and normalize service responses**

Add `getWorld` and `deleteWorld` to `createAssetService`. Normalize world profiles to the same public naming convention used by archive summaries, without adding image or prompt records to `content_worlds`.

- [ ] **Step 6: Run Task 2 tests and verify GREEN**

Run: `node --test tests/asset-database.test.mjs tests/asset-service.test.mjs tests/archive-delete.test.mjs tests/content-archive.test.mjs`

Expected: all selected tests pass.

- [ ] **Step 7: Commit Task 2**

```bash
git add src/server/assets/database.mjs src/server/assets/assetService.mjs src/server/assets/types.d.mts tests/asset-database.test.mjs tests/asset-service.test.mjs tests/archive-delete.test.mjs tests/content-archive.test.mjs
git commit -m "feat: persist editable world and character archives"
```

### Task 3: Agent Revision Contract Without Implicit Navigation

**Files:**
- Modify: `src/agent/npcCreator.ts`
- Modify: `api/npc.ts`
- Modify: `src/server/npcWorkflow.mjs`
- Modify: `tests/frontend-request-shape.test.mjs`
- Modify: `tests/server-workflow.test.mjs`
- Modify: `tests/server-npc-review-loop.test.mjs`

**Interfaces:**
- Consumes: current draft content and stable IDs from Task 1.
- Produces: `CreateNPCOptions` fields `intent: 'create' | 'revise' | 'regenerate'`, `currentWorld?: WorldProfile`, and `currentNpc?: NPC`.
- Preserves: response statuses `needs_clarification`, `world_ready`, and `complete`; these statuses describe result completeness only.
- Sends: request fields `phase`, `intent`, `currentWorld`, `currentNpc`, and `messages` to `/api/npc`.

- [ ] **Step 1: Write failing frontend request tests**

Add cases proving a world revision sends `phase: 'world'`, `intent: 'revise'`, and the complete current world; a character revision sends `phase: 'npc'`, `intent: 'revise'`, the current NPC, and its confirmed world. Assert IDs are included in the current draft and no client-side phase mutation is encoded in the request.

- [ ] **Step 2: Run frontend contract tests and verify RED**

Run: `node --test tests/frontend-request-shape.test.mjs`

Expected: FAIL because revision fields are absent.

- [ ] **Step 3: Extend the client request contract**

Update `createNPC(messages, options)` to transmit the new fields while retaining current response sanitization and cancellation behavior.

- [ ] **Step 4: Write failing server revision tests**

Assert that:

- revise instructions include the current complete draft and require untouched fields to be preserved;
- regenerate instructions allow field replacement but keep the archive ID;
- world operations never ask the model to create an NPC;
- character operations never return a world-stage navigation result;
- malformed revised output leaves validation behavior unchanged.

- [ ] **Step 5: Implement revision-aware server instructions**

Build phase-specific instructions from `intent` and current content in both Vercel and local-server paths. Do not trust model-returned IDs: reapply the request archive ID to validated world/NPC output before returning it.

- [ ] **Step 6: Run Task 3 tests and verify GREEN**

Run: `node --test tests/frontend-request-shape.test.mjs tests/server-workflow.test.mjs tests/server-npc-review-loop.test.mjs`

Expected: all selected tests pass.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/agent/npcCreator.ts api/npc.ts src/server/npcWorkflow.mjs tests/frontend-request-shape.test.mjs tests/server-workflow.test.mjs tests/server-npc-review-loop.test.mjs
git commit -m "feat: support iterative world and character revisions"
```

### Task 4: Asset HTTP and Browser Client Support for World Archives

**Files:**
- Modify: `src/server/assets/http.mjs`
- Modify: `src/agent/assetApi.mjs`
- Modify: `src/agent/assetApi.d.mts`
- Modify: `tests/remote-asset-api.test.mjs`
- Modify: `tests/asset-api-client.test.mjs`

**Interfaces:**
- Consumes: Task 2 service methods.
- Produces client methods: `getWorld(id)`, `saveWorld(world)`, and `deleteWorld(id)`.
- Produces HTTP behavior: `GET /api/assets/archive?worldId=<id>`, `POST /api/assets/archive` with `{ world }`, and `DELETE /api/assets/archive` with `{ worldId }`.
- Extends `listRemoteAssets()` result with `worlds: ContentWorld[]` while preserving `archives` and `usage`.

- [ ] **Step 1: Write failing HTTP routing tests**

Assert exact method/body/query routing for world get, upsert, list, and delete, including a 404 envelope for an unknown world and idempotent deletion.

- [ ] **Step 2: Run HTTP tests and verify RED**

Run: `node --test tests/remote-asset-api.test.mjs`

Expected: FAIL on unsupported world detail/delete routes.

- [ ] **Step 3: Implement the server routes**

Route world operations before generic character archive operations and keep existing internal-beta/workspace guards unchanged.

- [ ] **Step 4: Write failing browser-client tests**

Assert that methods use the existing workspace header, encode IDs, return typed payloads, and do not create a new workspace when reopening an existing world.

- [ ] **Step 5: Implement and type the client methods**

Add `ContentWorld` fields `id`, `name`, `profile`, and `updatedAt`. Preserve existing method names so `ContentWorkspace` remains compatible.

- [ ] **Step 6: Run Task 4 tests and verify GREEN**

Run: `node --test tests/remote-asset-api.test.mjs tests/asset-api-client.test.mjs`

Expected: all selected tests pass.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/server/assets/http.mjs src/agent/assetApi.mjs src/agent/assetApi.d.mts tests/remote-asset-api.test.mjs tests/asset-api-client.test.mjs
git commit -m "feat: expose world archive operations"
```

### Task 5: Editable World and Character Creation Workspace

**Files:**
- Create: `src/components/CreationWorkspace.tsx`
- Create: `src/components/WorldFieldsEditor.tsx`
- Create: `src/components/CharacterFieldsEditor.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Create: `tests/creation-workspace-state.test.mjs`
- Modify: `tests/frontend-concurrency.test.mjs`

**Interfaces:**
- Consumes: Task 1 session API, Task 3 generation API, and Task 4 asset client.
- Produces: `CreationWorkspaceProps { initialWorld?: WorldProfile; initialNpc?: NPC; openArchive?: { kind: CreationKind; id: string }; onWorldChange(world: WorldProfile | null): void; onNpcChange(npc: NPC | null): void; onArchiveSaved(): void }`.
- Produces explicit actions: new, revise, regenerate, edit fields, save, save as, enter character, return to world.

- [ ] **Step 1: Write failing workspace-controller tests**

Test the pure event/controller layer used by the component. Assert:

- a completed world response updates the world and leaves `activeKind === 'world'`;
- a completed character response leaves `activeKind === 'character'`;
- save uses the existing ID and marks saved only after a successful response;
- failed save/revision retains content and dirty state;
- Save As uses a fresh ID;
- returning to world retains the character draft;
- leaving a dirty archive requires confirmation.

- [ ] **Step 2: Run workspace tests and verify RED**

Run: `node --test tests/creation-workspace-state.test.mjs tests/frontend-concurrency.test.mjs`

Expected: FAIL because the workspace controller does not exist.

- [ ] **Step 3: Implement the focused editors**

`WorldFieldsEditor` edits `name`, `genre`, `era`, `atmosphere`, `coreRule`, `centralConflict`, and `summary`. `CharacterFieldsEditor` edits all current NPC string fields plus list editors for `personality` and `behaviorRules`. Every edit preserves the archive ID and marks the draft dirty.

- [ ] **Step 4: Implement `CreationWorkspace` actions and request lifecycle**

Use the existing request guard to prevent duplicate generation. Revision text and quick answers must call the current active kind only. Buttons, not model status, call `switchCreationKind`. Save characters via `saveRemoteArchive` with `{ category: 'character', worldId, world: snapshot }`; save worlds via `saveWorld`.

- [ ] **Step 5: Replace the legacy creation JSX in `App.tsx`**

Remove the forced `confirmWorld` navigation and delegate creation rendering to `CreationWorkspace`. Keep `world` and `npc` callbacks in `App` so visual-production profiles continue to receive the latest drafts.

- [ ] **Step 6: Add status and action styling**

Render exact labels `未保存草稿`, `已保存`, and `有未保存更改`. Provide explicit buttons named `保存档案`, `另存为新世界`/`另存为新角色`, `进入角色设计`, `返回世界观`, and `新建角色`.

- [ ] **Step 7: Run Task 5 tests and build**

Run: `node --test tests/creation-workspace-state.test.mjs tests/frontend-concurrency.test.mjs && npm run build`

Expected: selected tests pass and TypeScript/Vite build exits 0.

- [ ] **Step 8: Commit Task 5**

```bash
git add src/components/CreationWorkspace.tsx src/components/WorldFieldsEditor.tsx src/components/CharacterFieldsEditor.tsx src/App.tsx src/App.css tests/creation-workspace-state.test.mjs tests/frontend-concurrency.test.mjs
git commit -m "feat: add editable world and character workspace"
```

### Task 6: Unified Asset Library Opening, Filtering, and Safe World Deletion

**Files:**
- Modify: `src/content/categories.mjs`
- Modify: `src/content/categories.d.mts`
- Modify: `src/agent/contentLibrary.mjs`
- Modify: `src/components/ContentWorkspace.tsx`
- Modify: `src/components/ContentItemDetail.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/asset-type.test.mjs`
- Modify: `tests/content-library.test.mjs`
- Modify: `tests/content-archive.test.mjs`
- Create: `tests/world-character-navigation.test.mjs`

**Interfaces:**
- Consumes: Task 4 `worlds` list and world CRUD methods; Task 5 `openArchive` prop.
- Produces: `ContentCategory` including `'world'` for library filtering only; generation continues to accept only character/map/scene/prop.
- Produces: library edit navigation `{ kind: 'world' | 'character', id: string }` passed to `CreationWorkspace`.

- [ ] **Step 1: Write failing category and library tests**

Assert that world summaries are classified as `world`, appear in counts and search, and are not offered as a visual-generation category. Assert same-name/different-ID entries are both returned.

- [ ] **Step 2: Run library tests and verify RED**

Run: `node --test tests/asset-type.test.mjs tests/content-library.test.mjs tests/content-archive.test.mjs`

Expected: FAIL because `world` is not a supported library category.

- [ ] **Step 3: Add the world library category without widening image generation**

Separate browsable categories from generatable asset categories. `contentGeneration.mjs` must continue rejecting `world` as an image/design generation category.

- [ ] **Step 4: Write failing navigation and deletion tests**

Assert that opening a world/character selects the matching creation workspace and ID, refresh reopens the same ID, and deleting a world shows its linked-character count then detaches rather than deletes those characters.

- [ ] **Step 5: Implement library cards and edit navigation**

Merge world summaries into the displayed library model with zero prompt/image counts. World cards show genre, era, summary, and linked-character count. Character cards show their world name or `独立角色`.

- [ ] **Step 6: Implement safe deletion flow**

Call `deleteWorld` for world entries and display `将保留并转为独立角色` in the confirmation. Reload worlds and archives after success; do not remove character cards from client state.

- [ ] **Step 7: Run Task 6 tests and build**

Run: `node --test tests/asset-type.test.mjs tests/content-library.test.mjs tests/content-archive.test.mjs tests/world-character-navigation.test.mjs && npm run build`

Expected: selected tests pass and build exits 0.

- [ ] **Step 8: Commit Task 6**

```bash
git add src/content/categories.mjs src/content/categories.d.mts src/agent/contentLibrary.mjs src/components/ContentWorkspace.tsx src/components/ContentItemDetail.tsx src/App.tsx tests/asset-type.test.mjs tests/content-library.test.mjs tests/content-archive.test.mjs tests/world-character-navigation.test.mjs
git commit -m "feat: manage worlds and characters from the asset library"
```

### Task 7: Legacy Migration, Full Verification, and Deployment

**Files:**
- Modify: `src/agent/assetMigration.mjs`
- Modify: `tests/asset-migration.test.mjs`
- Modify: `tests/content-migration.test.mjs`
- Modify: `README.md` if current workflow documentation exists there

**Interfaces:**
- Consumes: Task 2 persistence rules and Task 4 client operations.
- Produces: deterministic stable IDs for recovered legacy world/character records and no duplicate migration on refresh.

- [ ] **Step 1: Write failing legacy migration tests**

Assert that a legacy current world receives and retains one stable ID, a legacy NPC without `worldId` remains an independent character, repeated migration does not duplicate either archive, and old `npc-forge-*` keys remain available according to existing cleanup rules.

- [ ] **Step 2: Run migration tests and verify RED**

Run: `node --test tests/asset-migration.test.mjs tests/content-migration.test.mjs`

Expected: FAIL on world identity or duplicate prevention.

- [ ] **Step 3: Implement compatibility migration**

Derive deterministic IDs from the existing workspace plus the legacy record fingerprint. Save worlds before linked characters. Do not rename storage keys or delete retryable records.

- [ ] **Step 4: Run migration tests and verify GREEN**

Run: `node --test tests/asset-migration.test.mjs tests/content-migration.test.mjs`

Expected: all migration tests pass.

- [ ] **Step 5: Run full verification**

Run:

```bash
node --test tests/*.test.mjs
npm run lint
npm run build
```

Expected: zero test failures, lint exit 0 with no new warnings, build exit 0.

- [ ] **Step 6: Perform a non-billable browser acceptance check**

Using mocked/local generation responses, verify: create and save two worlds; revise one without increasing the count; create two linked characters; return to a world without losing characters; reopen both kinds from the asset library; delete the world and observe both characters become independent. Do not call a paid LLM or image API.

- [ ] **Step 7: Commit Task 7**

```bash
git add src/agent/assetMigration.mjs tests/asset-migration.test.mjs tests/content-migration.test.mjs README.md
git commit -m "feat: migrate editable creation archives"
```

- [ ] **Step 8: Request final code review**

Use `superpowers:requesting-code-review`, resolve findings with `superpowers:receiving-code-review`, then rerun the full verification commands.

- [ ] **Step 9: Push and verify production deployment**

Push the reviewed commits to `origin/master`, wait for the existing Vercel deployment, and verify the deployed JavaScript contains the new workspace labels and the readiness/login endpoints remain healthy. Do not perform paid generation during deployment verification.
