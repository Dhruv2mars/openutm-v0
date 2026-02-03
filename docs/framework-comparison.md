# Framework Comparison: Tauri vs Electron

**Date**: February 2026  
**Status**: Initial MVP Comparison  
**Decision**: TBD (Recommendation: Tauri)

---

## Overview

OpenUTM was built with both Tauri and Electron frontends to empirically compare them for VM management use cases. This document summarizes findings.

---

## Bundle Size Comparison

| Metric | Tauri | Electron | Winner |
|--------|-------|----------|--------|
| App Bundle (.app) | 8.3 MB | 236 MB | **Tauri** (28x smaller) |
| DMG Installer | 3.0 MB | 96 MB | **Tauri** (32x smaller) |
| ZIP Archive | ~3 MB | ~90 MB | **Tauri** |

**Analysis**: Tauri's dramatic size advantage comes from using the system's native WebView instead of bundling Chromium. For a download-and-run app, this significantly improves user experience.

---

## Memory Usage

*TODO: Measure at runtime*

| State | Tauri | Electron | Expected |
|-------|-------|----------|----------|
| Idle (no VMs) | TBD | TBD | Tauri ~100-200MB, Electron ~400-500MB |
| 1 VM Running | TBD | TBD | |
| 3 VMs Running | TBD | TBD | |

**Expected**: Electron typically uses 2-3x more memory due to Chromium overhead.

---

## Startup Time

*TODO: Measure cold and warm start*

| Metric | Tauri | Electron | Expected |
|--------|-------|----------|----------|
| Cold Start | TBD | TBD | Tauri faster |
| Warm Start | TBD | TBD | Similar |

---

## Developer Experience

| Factor | Tauri | Electron | Notes |
|--------|-------|----------|-------|
| Build Time | ~30s (Rust compile) | ~10s | Electron faster for dev iteration |
| Hot Reload | Yes (Vite) | Yes (Vite) | Same frontend experience |
| Debugging | Tauri DevTools | Chrome DevTools | Electron more familiar |
| Backend Language | Rust | JavaScript/TypeScript | Depends on team skills |
| Native APIs | Via Rust FFI | Via Node.js | Both sufficient for our needs |
| Ecosystem | Growing | Massive | Electron has more libraries |

---

## Native Integration (VM-Specific)

| Capability | Tauri | Electron | Notes |
|------------|-------|----------|-------|
| Process Spawning (QEMU) | `tokio::process` | `child_process` | Both work well |
| Unix Sockets (QMP) | `tokio::net` | `net` module | Both work |
| File System Access | Full access | Full access | Same |
| System Info | `sysinfo` crate | Multiple npm packages | Similar |
| HVF Entitlements | Supported | Supported | Both can request hypervisor access |

---

## Security

| Factor | Tauri | Electron |
|--------|-------|----------|
| Attack Surface | Smaller (no Node.js in renderer) | Larger (full Node.js access possible) |
| CSP Default | Strict | Permissive |
| IPC Security | Type-safe commands | Requires careful configuration |
| Updates | Tauri Updater (Rust) | electron-updater |

**Winner**: Tauri has a smaller attack surface by design.

---

## Platform Support

| Platform | Tauri | Electron |
|----------|-------|----------|
| macOS | ✅ | ✅ |
| Linux | ✅ | ✅ |
| Windows | ✅ | ✅ |
| WebView Required | System WebView | Bundled Chromium |

**Note**: Tauri on Linux requires WebKitGTK; older distros may have outdated versions.

---

## Recommendation

**Recommended Framework: Tauri**

### Rationale:

1. **Size**: 28x smaller bundle is huge for user experience. Users can download and start using in seconds.

2. **Resources**: Lower memory/CPU footprint matters for VM workloads where resources should go to guest VMs, not the host app.

3. **Security**: Smaller attack surface is important for a hypervisor app.

4. **Performance**: Rust backend can handle high-throughput QMP communication more efficiently.

5. **Modern Stack**: Tauri v2 is stable and actively developed.

### Trade-offs Accepted:

- Longer build times (mitigated by Rust incremental compilation)
- Smaller ecosystem (mitigated by using React for UI)
- Rust learning curve (mitigated by existing Rust knowledge or TypeScript for most logic)

---

## Decision

**Primary Framework**: Tauri  
**Secondary/Deprecated**: Electron (keep for compatibility testing, may remove in future)

---

## Appendix: Build Commands

### Tauri
```bash
cd apps/tauri
bun tauri build        # Release build
bun tauri dev          # Development
```

### Electron
```bash
cd apps/electron
bun run dist           # Release build (DMG + ZIP)
bun run pack           # Build without packaging
bun run dev            # Development
```
