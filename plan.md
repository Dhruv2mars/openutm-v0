# OpenUTM Release Plan (Approved)

## Top (Static: Full Approved Plan)

### Goal
Build both desktop apps to production grade for public use on macOS now.

### Non-Negotiables
- Build both apps with equal quality: Tauri + Electron.
- TDD always: failing test first, then impl, then green.
- 100% coverage gate where tests run.
- Manual testing + unit/integration testing both apps.
- Real runtime verification: download/install/run/test packaged apps.
- Branch workflow: branch -> PR -> merge main -> delete branch.
- App naming must clearly show framework: `(Tauri)` and `(Electron)`.
- Platform scope now: macOS only.

### Phase 1 — Quality Gates Foundation
Context: Current test/lint/coverage/release gates weak; tests run in watch mode; no hard release criteria.

Tasks:
- 1.1 Make test commands deterministic (no watch in CI/local release flow).
- 1.2 Add lint config + enforce zero lint warnings/errors.
- 1.3 Add coverage deps/config + enforce 100% threshold.
- 1.4 Add release gate script (`verify:release`) used by CI.
- 1.5 Update CI workflows to fail hard on gate misses.

Acceptance:
- Single command validates release gates.
- CI reproducible and strict.

### Phase 2 — Electron Production Runtime
Context: Electron renderer uses mock VM/QEMU data; real backend path not wired end-to-end.

Tasks:
- 2.1 Replace mock renderer flows with real IPC calls.
- 2.2 Harden preload API surface (typed, minimal, safe).
- 2.3 Complete IPC handlers for VM lifecycle + config + storage + detection.
- 2.4 Strengthen QEMU/QMP/controller error handling and state sync.
- 2.5 Add/adjust tests first for all behavior changes.

Acceptance:
- Electron app manages real VM lifecycle via backend.
- No mock data in runtime path.

### Phase 3 — Tauri Production Runtime
Context: Tauri commands include placeholders; runtime path incomplete.

Tasks:
- 3.1 Replace placeholder commands with real implementations.
- 3.2 Wire config store + disk manager + qemu controller into command layer.
- 3.3 Implement real QEMU detect/start/stop/pause/resume/list/get/delete.
- 3.4 Ensure frontend uses real invoke calls; remove runtime mocks.
- 3.5 Add/adjust Rust + UI tests first for all behavior changes.

Acceptance:
- Tauri app manages real VM lifecycle via backend.
- No placeholder runtime paths.

### Phase 4 — SPICE/QMP Feature Completeness (Both)
Context: SPICE/QMP coverage exists in tests, but full product behavior parity not complete.

Tasks:
- 4.1 Finalize QMP command/event handling used in runtime.
- 4.2 Integrate SPICE session in app window (both apps).
- 4.3 Validate clipboard/audio/dynamic resolution behavior.
- 4.4 Add failure/recovery flows (socket drop, VM crash, reconnect).
- 4.5 Add tests for protocol and UI state transitions.

Acceptance:
- Both apps provide stable SPICE/QMP lifecycle behavior.

### Phase 5 — Naming, Packaging, Manual Verification, Release
Context: Must visibly differentiate framework variant and prove public readiness.

Tasks:
- 5.1 Ensure naming suffix appears in user-facing app identity surfaces.
- 5.2 Build distributables for both apps on macOS.
- 5.3 Run manual verification matrix on both apps + packaged binaries.
- 5.4 Fix defects via TDD until matrix fully green.
- 5.5 Produce release checklist report with evidence.

Acceptance:
- Both packaged apps pass manual + automated release matrix.
- Naming clearly indicates `(Tauri)` vs `(Electron)`.

### Phase 6 — Branch/PR Execution Discipline
Context: Required operating model for all significant work.

Tasks:
- 6.1 Use focused branch per task group.
- 6.2 Keep atomic commits (`feat:`, `fix:`, `test:`).
- 6.3 Open PR with evidence + risk notes.
- 6.4 Merge to `main`, delete branch.

Acceptance:
- All delivered work follows branch/PR discipline.

### Unresolved Questions
- none

---

## Bottom (Progress Tracking)

## Phase 1 — Quality Gates Foundation
Status: DONE
- [x] 1.1 Make test commands deterministic (no watch).
- [x] 1.2 Add lint config + enforce zero lint warnings/errors.
- [x] 1.3 Add coverage deps/config + enforce 100% threshold.
- [x] 1.4 Add release gate script (`verify:release`).
- [x] 1.5 Update CI workflows to enforce gates.

## Phase 2 — Electron Production Runtime
Status: DONE
- [x] 2.1 Replace mock renderer flows with real IPC calls.
- [x] 2.2 Harden preload API surface.
- [x] 2.3 Complete IPC handlers for VM lifecycle/config/storage/detection.
- [x] 2.4 Harden QEMU/QMP/controller runtime behavior.
- [x] 2.5 Add tests first for all behavior changes.

## Phase 3 — Tauri Production Runtime
Status: DONE
- [x] 3.1 Replace placeholder commands with real implementations.
- [x] 3.2 Wire config/storage/qemu into commands.
- [x] 3.3 Implement real VM lifecycle command handlers.
- [x] 3.4 Remove frontend runtime mocks; wire invoke path.
- [x] 3.5 Add tests first for all behavior changes.

## Phase 4 — SPICE/QMP Feature Completeness (Both)
Status: IN PROGRESS
- [x] 4.1 Finalize runtime QMP handling.
- [ ] 4.2 Integrate SPICE session in app window.
- [ ] 4.3 Validate clipboard/audio/dynamic resolution.
- [ ] 4.4 Add failure/recovery flows.
- [ ] 4.5 Add protocol/UI transition tests.

## Phase 5 — Naming, Packaging, Manual Verification, Release
Status: DONE
- [x] 5.1 Apply `(Tauri)` and `(Electron)` naming in user-facing identity.
- [x] 5.2 Build macOS distributables for both apps.
- [x] 5.3 Run manual verification matrix on dev + packaged apps.
- [x] 5.4 Fix defects via TDD until fully green.
- [x] 5.5 Publish release checklist report.

## Phase 6 — Branch/PR Execution Discipline
Status: IN PROGRESS
- [x] 6.1 Use focused branch per task group.
- [x] 6.2 Keep atomic commits.
- [ ] 6.3 Open PR with evidence.
- [ ] 6.4 Merge main + delete branch.
