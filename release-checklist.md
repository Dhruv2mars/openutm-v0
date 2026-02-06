# OpenUTM macOS Release Checklist (2026-02-06)

## Scope
- Platform: macOS only
- Targets: `OpenUTM (Electron)` + `OpenUTM (Tauri)`

## Automated Gates
- `bun run verify:release`: PASS
- Electron tests/lint/typecheck: PASS
- Tauri tests/lint/typecheck + native rust tests: PASS
- Coverage gate: PASS (100% where configured)

## Packaging
- Electron app bundle (`--dir`) build: PASS
- Tauri app bundle + dmg build: PASS
- Install script copy to `/Applications`: PASS
  - `/Applications/OpenUTM (Electron).app`
  - `/Applications/OpenUTM (Tauri).app`

## Manual Runtime Smoke
- Electron packaged app launch: PASS
  - Process up
  - Window count: `1`
  - Renderer process count: `1`
  - QEMU setup UI renders in packaged app (no blank window)
- Tauri packaged app launch: PASS
  - Process up
  - Window count: `1`

## Naming Verification
- App bundle names include framework suffix: PASS
- Window title fallback includes framework suffix in UI: PASS

## Runtime Backend Verification
- Electron runtime wired to real IPC/backend (no renderer mocks): PASS
- Tauri runtime wired to real invoke/backend (no renderer mocks): PASS
- VM CRUD/lifecycle routes implemented end-to-end in both apps: PASS

## Notes
- Electron config storage moved to file-backed JSON store to avoid native sqlite packaging/runtime failures.
- Electron packaged renderer asset base fixed to relative paths (`./assets/...`) to prevent white-screen on `file://` load.
- Electron DMG build may intermittently fail locally (`hdiutil`); app bundle output remains valid via `electron-builder --dir`.
