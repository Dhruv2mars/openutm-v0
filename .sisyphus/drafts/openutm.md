# Draft: OpenUTM - Cross-Platform UTM Alternative (UPDATED)

## Vision
A cross-platform, open source hypervisor that makes it easy for anybody to have a mini computer inside their own computer.

## Updated Decisions (from user feedback)

### Tech Stack - DUAL FRAMEWORK APPROACH
- **Frontends**: BOTH Tauri AND Electron
  - Tauri: Rust backend + React frontend
  - Electron: Node.js backend + React frontend
- **Rationale**: A/B testing to empirically determine which works best for VM management

### Display
- **Primary**: SPICE protocol (confirmed)
- **Rationale**: Clipboard/audio sharing, dynamic resolution, integrated app window

### Budget Constraints
- **Code signing**: NO budget for now (unsigned builds)
- **Apple Developer**: Skip initially (app will show untrusted warning)
- **Windows EV**: Skip initially

### CI/CD
- **Platform**: GitHub Actions (free for public repos)
- **Features**: Automated testing, multi-platform builds, releases

### Telemetry
- **Status**: Opt-in only
- **Data collected**: VM counts, feature usage, errors (no personal data)
- **Provider**: TBD (PostHog free tier recommended)

## Architecture

### Monorepo Structure (Dual Framework)
```
openutm/
├── apps/
│   ├── tauri/                # Tauri application
│   │   ├── src-tauri/        # Rust backend
│   │   └── src/              # React frontend
│   └── electron/             # Electron application
│       ├── src/              # React frontend
│       └── electron-src/     # Node.js backend
├── packages/
│   ├── ui/                   # Shared React components
│   ├── vm-core/              # VM lifecycle logic (TS)
│   ├── qemu-lib/             # QEMU abstraction layer (TS)
│   ├── shared-types/         # Common TypeScript definitions
│   └── native-bridge/        # Shared native module interface
├── turbo.json
├── package.json
└── README.md
```

### Backend Architectures

**Tauri (Rust):**
```
[tauri::command]
    ↓
[vm-service] → [qemu-controller] → [QMP socket]
    ↓                ↓
[storage-mgr]   [platform-detector]
    ↓
[config-store]
```

**Electron (Node.js):**
```
[ipcMain handler]
    ↓
[vm-service] → [child_process spawn] → [QEMU process]
    ↓                ↓
[storage-mgr]   [platform-detector]
    ↓
[config-store]
```

## Key Insights from Research

### Why Both Frameworks?
- Tauri: 2.6MB bundle, ~310MB memory, native Rust backend
- Electron: 166MB bundle, ~460MB memory, massive ecosystem
- Need empirical data to decide winner

### Why Not libvirt?
- libvirt cross-platform support is WEAK
- macOS/Windows networking/storage pools don't work properly
- Direct QEMU/QMP gives full control
- Follow UTM's pattern (direct QEMU)

### Display Protocols Explained
- **SPICE**: Integrated in app window, clipboard/audio sharing, dynamic resolution
- **VNC**: Simpler but worse performance, no audio
- **Native window**: Spawns external viewer app (separate window, most reliable)
- **Choice**: SPICE for integrated UX

## Open Questions Remaining
1. Telemetry provider: PostHog vs Plausible vs custom?
2. Cloud VMs: Future feature? (recommend: no for now)
3. Container support: Docker alongside VMs? (recommend: future phase)
4. Mobile companion app: iOS/Android? (recommend: not in roadmap)

## Next Steps
1. Create `plan.md` in project root from `.sisyphus/plans/openutm.md`
2. Create `AGENTS.md` with project context
3. Run `/start-work` to begin execution
4. Start with Phase 1: Foundation

## Research Sources
- UTM: https://mac.getutm.app
- Quickemu: https://github.com/quickemu-project/quickemu
- Sqimp (Tauri QEMU UI): https://github.com/RedBe-an/Sqimp
- Tauri: https://tauri.app
- QMP: https://wiki.qemu.org/Documentation/QMP
