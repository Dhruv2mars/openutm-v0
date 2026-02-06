# Electron Public-Release Plan (Approved)

## Top (Static: Full Approved Plan)

### Goal
Ship Electron app public-ready on macOS, father-safe UX, UTM-like core flow.

### Scope Locked
- Electron only for this cycle.
- macOS universal artifact target (single app for arm64 + x64).
- Manual workflow must include full Ubuntu LTS install flow.
- Verification pass requires 2 consecutive full green cycles.

### Non-Negotiables
- TDD always: failing test first, then impl, then green.
- 100% coverage for Electron release scope.
- Automated gates + manual workflow both required.
- Embedded SPICE display required (not endpoint-only).
- In-app QEMU setup flow required (Terminal Homebrew path).
- Naming must remain `OpenUTM (Electron)` in user-facing identity.

### Public API / Interface Changes
- Extend display session payload with renderer-connect data (`websocketUri` optional).
- Extend preload + renderer bridge with QEMU install actions:
  - `qemu-install-command`
  - `qemu-install-terminal`
- Keep existing VM lifecycle IPC contracts stable.

### Phase 1 — Electron Gate Hardening
Context: Existing release gate is broad repo gate; Electron-specific coverage and release checks need strict pass/fail control.

Tasks:
- 1.1 Add Electron coverage command + hard 100% threshold.
- 1.2 Add `verify:electron-release` script (lint/typecheck/test/coverage/build/package sanity).
- 1.3 Add CI jobs for arm64 full gate + x64 smoke gate.
- 1.4 Add packaged app sanity checks (title/window/load path).

Acceptance:
- Single Electron release command fails on any gate miss.

### Phase 2 — QEMU Setup UX (Consumer-ready)
Context: Setup wizard UI exists but install path not fully wired from Electron runtime.

Tasks:
- 2.1 Add IPC for Homebrew command generation.
- 2.2 Add IPC to open Terminal with install command.
- 2.3 Wire wizard install action in renderer App.
- 2.4 Add robust retry/error states.
- 2.5 Add tests first for each setup state.

Acceptance:
- Missing QEMU flow can guide user to install + recover without dead ends.

### Phase 3 — VM Runtime Reliability
Context: Runtime works for basic flows but needs hardening for release-safe behavior across QEMU paths and lifecycle edge cases.

Tasks:
- 3.1 Use detected QEMU binary in start path (remove hardcoded binary).
- 3.2 Make accelerator selection deterministic (HVF preferred on macOS, fallback TCG).
- 3.3 Harden install-media + boot-order + reboot path.
- 3.4 Constrain unreliable network modes for release-safe defaults.
- 3.5 Add tests first for failure paths and edge cases.

Acceptance:
- End-to-end VM lifecycle reliable across restart/reopen/error paths.

### Phase 4 — Embedded SPICE Display
Context: Current display tab shows session metadata only; no embedded viewer.

Tasks:
- 4.1 Add SPICE TCP->WebSocket proxy lifecycle in Electron runtime.
- 4.2 Add renderer embedded SPICE viewer using `@spice-project/spice-html5`.
- 4.3 Replace endpoint-only view with live session panel.
- 4.4 Add reconnect/disconnect handling and user feedback.
- 4.5 Add tests first for proxy/session/UI transitions.

Acceptance:
- User can open VM display in-app and observe stable session state transitions.

### Phase 5 — Universal Packaging
Context: Existing packaging targets arm64 only.

Tasks:
- 5.1 Build universal DMG + ZIP outputs.
- 5.2 Preserve naming identity across metadata + UI.
- 5.3 Validate packaged launch from `/Applications`.
- 5.4 Add x64 smoke validation in CI.

Acceptance:
- Public artifacts support both Apple Silicon + Intel Macs.

### Phase 6 — Manual Verification Loop Until Pass
Context: Final readiness must be proven by repeated full workflow execution with evidence.

Tasks:
- 6.1 Define strict manual checklist: install flow start->end (Ubuntu LTS).
- 6.2 Add evidence capture scripts/log paths/screenshots.
- 6.3 Run full cycle #1 (automated + manual + packaged).
- 6.4 Fix defects via TDD, rerun affected gates.
- 6.5 Run full cycle #2 fully green.
- 6.6 Publish verification report with PASS/FAIL verdict.

Acceptance:
- `verification_status=PASSED` only after 2 consecutive full green cycles.

### Assumptions / Defaults
- No code signing/notarization in this cycle.
- Ubuntu ISO source: Canonical latest LTS.
- QEMU install action opens Terminal command for user execution (no privileged in-app shell).

### Unresolved Questions
- none

---

## Bottom (Progress Tracking)

## Phase 1 — Electron Gate Hardening
Status: DONE
- [x] 1.1 Add Electron coverage command + hard 100% threshold.
- [x] 1.2 Add `verify:electron-release` script.
- [x] 1.3 Add CI jobs arm64 full + x64 smoke.
- [x] 1.4 Add packaged app sanity checks.

## Phase 2 — QEMU Setup UX (Consumer-ready)
Status: DONE
- [x] 2.1 Add IPC for Homebrew command generation.
- [x] 2.2 Add IPC to open Terminal with install command.
- [x] 2.3 Wire wizard install action in renderer App.
- [x] 2.4 Add robust retry/error states.
- [x] 2.5 Add tests first for each setup state.

## Phase 3 — VM Runtime Reliability
Status: DONE
- [x] 3.1 Use detected QEMU binary in start path.
- [x] 3.2 Make accelerator selection deterministic.
- [x] 3.3 Harden install-media + boot-order + reboot path.
- [x] 3.4 Constrain unreliable network modes.
- [x] 3.5 Add tests first for failure paths.

## Phase 4 — Embedded SPICE Display
Status: DONE
- [x] 4.1 Add SPICE TCP->WebSocket proxy lifecycle.
- [x] 4.2 Add renderer embedded SPICE viewer.
- [x] 4.3 Replace endpoint-only display panel.
- [x] 4.4 Add reconnect/disconnect handling.
- [x] 4.5 Add tests for proxy/session/UI transitions.

## Phase 5 — Universal Packaging
Status: DONE
- [x] 5.1 Build universal DMG + ZIP outputs.
- [x] 5.2 Preserve naming identity.
- [x] 5.3 Validate packaged launch from `/Applications`.
- [x] 5.4 Add x64 smoke validation in CI.

## Phase 6 — Manual Verification Loop Until Pass
Status: DONE
- [x] 6.1 Define strict manual checklist.
- [x] 6.2 Add evidence capture scripts/log paths/screenshots.
- [x] 6.3 Run full cycle #1.
- [x] 6.4 Fix defects via TDD and rerun.
- [x] 6.5 Run full cycle #2.
- [x] 6.6 Publish verification report with `verification_status=PASSED`.
