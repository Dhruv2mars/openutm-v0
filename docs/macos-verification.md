# macOS Verification (2026-02-06)

## Scope
- Apps: `OpenUTM (Electron)`, `OpenUTM (Tauri)`
- Platform: macOS (arm64)

## Automated
- `bun run verify:release` -> pass
- `bun run --cwd apps/electron test` -> 104 passed, 0 failed
- `cargo test --manifest-path apps/tauri/src-tauri/Cargo.toml` -> 83 passed, 0 failed

## Packaging + Install
- Built bundles:
  - `apps/electron/release/mac-arm64/OpenUTM (Electron).app`
  - `apps/tauri/src-tauri/target/release/bundle/macos/OpenUTM (Tauri).app`
- Install command:
  - `bun run install:macos-apps`
  - copies with `ditto` to:
    - `/Applications/OpenUTM (Electron).app`
    - `/Applications/OpenUTM (Tauri).app`
- Name check:
  - `CFBundleName`/`CFBundleDisplayName` = `OpenUTM (Electron)` and `OpenUTM (Tauri)`

## Manual Runtime Smoke
- Packaged Electron:
  - launch `/Applications/OpenUTM (Electron).app/Contents/MacOS/OpenUTM (Electron)` -> process started, app active
- Packaged Tauri:
  - launch `/Applications/OpenUTM (Tauri).app/Contents/MacOS/openutm-tauri` -> process started, app active
- Dev Electron:
  - `bun run --cwd apps/electron dev` -> Vite up + Electron process running
- Dev Tauri:
  - `(cd apps/tauri && bunx vite --port 1420)` + `bun run --cwd apps/tauri dev` -> frontend + `target/debug/openutm-tauri` running

## Notes
- UI automation via macOS assistive APIs is blocked in this environment.
- Full guest OS install flow (ISO boot/install) not executed in this run.
