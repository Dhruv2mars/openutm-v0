# Electron Manual Workflow Checklist

## Scope
- Packaged app: `apps/electron/release/mac-universal/OpenUTM (Electron).app`
- ISO: Ubuntu LTS server (`ubuntu-24.04.3-live-server-amd64.iso`)
- Required pass: 2 consecutive full green cycles

## Per-cycle steps
1. Launch packaged app, confirm window visible.
2. Detect QEMU in-app (`detect-qemu` success).
3. Create VM.
4. Attach Ubuntu ISO.
5. Set boot order `cdrom-first`.
6. Start VM.
7. If SPICE supported: open display session and verify websocket endpoint present.
8. If SPICE unsupported: verify app reports SPICE unavailable cleanly (no crash).
9. Stop VM.
10. Set boot order `disk-first`.
11. Eject ISO.
12. Start VM again (disk boot path validation).
13. If SPICE supported: open + close display session.
14. Stop VM.
15. Delete VM and verify removal.
16. Capture screenshot + app log + cycle result JSON.

## Pass criteria
- All steps pass in cycle #1 and cycle #2.
- No crash/hang in packaged app.
- Verification report says `verification_status: PASSED`.
