# OpenUTM - Cross-Platform UTM Alternative

## Project Vision
A cross-platform, open source hypervisor that makes it easy for anybody to have a mini computer inside their own computer.

**Core Philosophy:** UTM-level ease of use, but truly cross-platform and open source.

---

## Final Decisions

### Platform Strategy
- **MVP**: macOS first (Apple Silicon + Intel)
- **Phase 2**: Linux (KVM backend)
- **Phase 3**: Windows (WHPX backend)
- **Rationale**: macOS has best HVF support, natural fit with Tauri, and is UTM's primary market

### Tech Stack
- **Frontends**: BOTH Tauri AND Electron (A/B testing to determine winner)
  - Tauri: Rust backend + React frontend (2.6MB bundle, native performance)
  - Electron: Node.js backend + React frontend (166MB bundle, massive ecosystem)
- **UI Framework**: React + TypeScript (shared between both)
- **Backend**: Direct QEMU control via QMP (not libvirt)
- **Monorepo**: Turborepo + Bun
- **Rationale**: Building both to empirically test which performs better for VM management. Winner becomes primary; other deprecated or kept for compatibility.

### Target User
- **Primary**: General consumers seeking VirtualBox replacement
- **Secondary**: Developers needing local dev environments
- **Priority**: Ease of use > Power features > Performance

### QEMU Strategy
- **Detection**: Auto-detect system QEMU
- **Fallback**: In-app download/install option
- **Bundling**: NO bundled QEMU (keeps app small)

### Display Protocol
- **Primary**: SPICE (clipboard, audio, dynamic resolution)
- **Fallback**: Native window with virt-viewer
- **Rationale**: Best consumer experience

---

## Architecture

### Monorepo Structure
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

### Dual Framework Architecture
Both apps share business logic through packages/, but have different backends:

**Tauri Backend (Rust):**
```
[tauri::command]
    ↓
[vm-service] → [qemu-controller] → [QMP socket]
    ↓                ↓
[storage-mgr]   [platform-detector]
    ↓
[config-store]
```

**Electron Backend (Node.js):**
```
[ipcMain handler]
    ↓
[vm-service] → [child_process spawn] → [QEMU process]
    ↓                ↓
[storage-mgr]   [platform-detector]
    ↓
[config-store]
```

**Shared Logic:**
- VM configuration (packages/vm-core)
- QEMU command building (packages/qemu-lib)
- UI components (packages/ui)
- Type definitions (packages/shared-types)

### Platform Abstraction
Each platform has different virtualization backends:
- **macOS**: Hypervisor.framework (HVF) + QEMU
- **Linux**: KVM + QEMU
- **Windows**: WHPX + QEMU

**Platform detection layer** will handle accelerator selection automatically.

### CI/CD & Distribution
- **CI/CD**: GitHub Actions (free for public repos)
  - Automated testing on every push
  - Build both Tauri and Electron binaries
  - Multi-platform builds (macOS, Linux, Windows)
  - Automated releases with changelogs
- **Auto-updates**: Tauri updater + electron-updater
  - Check GitHub releases for new versions
  - Download and install automatically
  - User can disable in settings

### Telemetry (Opt-in)
- Anonymous usage metrics to improve product
- Data collected (only if user opts in):
  - VM start/stop counts (no VM content)
  - Feature usage (e.g., "create VM wizard opened")
  - Error rates and types (no personal data)
  - App version and platform
- User can disable anytime in settings
- All data aggregated, never sold

---

## Phase 1 — Foundation
**Status**: IN PROGRESS
**Goal**: Project setup, architecture implementation, basic Tauri shell

### 1.1 Project Bootstrap
**What**: Initialize monorepo with Turborepo + Bun + Tauri
**Dependencies**: None
**Parallelizable**: NO

**Tasks**:
- [ ] Initialize git repo with main branch protection
- [ ] Create Turborepo structure with `apps/` and `packages/`
- [ ] Setup Bun as package manager
- [ ] Add .gitignore (node_modules, target/, .turbo, dist/)
- [ ] Configure turbo.json with pipeline
- [ ] Add README.md with development setup
- [ ] Setup LICENSE (MIT recommended)

**Acceptance Criteria**:
- [ ] `bun install` succeeds
- [ ] `turbo run build` works
- [ ] Git repo initialized with clean history
- [ ] README has clear setup instructions

**Commit**: `feat: initial project setup`

### 1.2 Tauri Application Shell
**What**: Create Tauri app with React frontend
**Dependencies**: 1.1
**Parallelizable**: NO

**Tasks**:
- [ ] Initialize Tauri app in `apps/tauri/`
- [ ] Configure tauri.conf.json with app metadata
- [ ] Setup React + TypeScript + Vite
- [ ] Add basic window configuration (size, title, etc.)
- [ ] Add placeholder menu bar (File, Edit, Window)
- [ ] Test basic window opens

**Acceptance Criteria**:
- [ ] `bun tauri dev` opens app window
- [ ] Window shows "OpenUTM" title
- [ ] React renders basic "Hello OpenUTM (Tauri)" component
- [ ] Dev tools work (React DevTools, Tauri DevTools)

**Commit**: `feat: tauri app shell`

### 1.3 Shared UI Package
**What**: Create reusable UI component library
**Dependencies**: 1.1
**Parallelizable**: YES (with 1.2)

**Tasks**:
- [ ] Create `packages/ui/` with package.json
- [ ] Setup React + TypeScript
- [ ] Configure build output (ESM + CJS)
- [ ] Add base components: Button, Card, Input, Select
- [ ] Add VM-specific components: VMStatusBadge, ResourceBar
- [ ] Setup Storybook for component development
- [ ] Export all components from index.ts

**Acceptance Criteria**:
- [ ] Components can be imported in desktop app
- [ ] `bun run build` in packages/ui succeeds
- [ ] Storybook shows components
- [ ] Button component has variants (primary, secondary, danger)

**Commit**: `feat: shared ui package`

### 1.4 Core Types Package
**What**: Shared TypeScript definitions
**Dependencies**: 1.1
**Parallelizable**: YES (with 1.2, 1.3)

**Tasks**:
- [ ] Create `packages/shared-types/` package
- [ ] Define core types:
  - `VM` interface (id, name, status, config)
  - `VMStatus` enum (stopped, running, paused, error)
  - `VMConfig` interface (cpu, memory, disks, network)
  - `Platform` enum (macos, linux, windows)
  - `Accelerator` enum (hvf, kvm, whpx, tcg)
- [ ] Add Zod schemas for runtime validation
- [ ] Export all types

**Acceptance Criteria**:
- [ ] Types can be imported by all other packages
- [ ] Zod schemas validate test objects
- [ ] No circular dependencies

**Commit**: `feat: shared types package`

### 1.5 Electron Application Shell
**What**: Create Electron app with React frontend
**Dependencies**: 1.1
**Parallelizable**: YES (with 1.2)

**Tasks**:
- [ ] Initialize Electron app in `apps/electron/`
- [ ] Setup React + TypeScript + Vite (same as Tauri)
- [ ] Configure Electron main process (main.js)
- [ ] Setup IPC handlers (preload.js)
- [ ] Add basic window configuration
- [ ] Test Electron window opens
- [ ] Add hot reload for development

**Acceptance Criteria**:
- [ ] `bun electron:dev` opens app window
- [ ] Window shows "OpenUTM (Electron)" title
- [ ] React renders same UI as Tauri version
- [ ] Dev tools work

**Commit**: `feat: electron app shell`

### 1.6 Node.js Backend Structure
**What**: Setup Node.js backend for Electron
**Dependencies**: 1.5
**Parallelizable**: YES (with 1.7)

**Tasks**:
- [ ] Create `apps/electron/electron-src/` structure:
  - `main.ts` - Entry point
  - `ipc-handlers.ts` - IPC handlers
  - `qemu/` - QEMU management (Node.js child_process)
  - `storage/` - VM disk management
  - `config/` - Settings persistence
- [ ] Add necessary dependencies:
  - `execa` or `child_process` (process spawning)
  - `sqlite3` or `better-sqlite3` (database)
  - `node-qmp` or custom QMP client

**Acceptance Criteria**:
- [ ] `bun electron:build` succeeds
- [ ] Node.js code has no TypeScript errors
- [ ] Module structure mirrors Tauri for comparison
- [ ] Basic IPC handler works

**Commit**: `feat: nodejs backend structure`

### 1.7 Rust Backend Structure
**What**: Setup Rust crate structure in Tauri
**Dependencies**: 1.2
**Parallelizable**: YES (with 1.6)

**Tasks**:
- [ ] Create Rust modules in `apps/tauri/src-tauri/src/`:
  - `main.rs` - Entry point
  - `commands.rs` - Tauri command handlers
  - `qemu/` - QEMU management
    - `mod.rs`
    - `detector.rs` - QEMU binary detection
    - `controller.rs` - VM lifecycle
    - `qmp.rs` - QMP protocol client
  - `platform/` - Platform abstraction
    - `mod.rs`
    - `macos.rs`
    - `linux.rs`
    - `windows.rs`
  - `storage/` - VM disk management
  - `config/` - Settings persistence
- [ ] Add necessary Cargo dependencies:
  - `serde`, `serde_json`
  - `tokio` (async runtime)
  - `thiserror` (error handling)
  - `tracing` (logging)
  - `qapi` (QMP protocol)
  - `sysinfo` (system info)

**Acceptance Criteria**:
- [ ] `cargo build` succeeds
- [ ] Rust code compiles without warnings
- [ ] Module structure is clean and organized
- [ ] Basic "hello" tauri command works

**Commit**: `feat: rust backend structure`

---

## Phase 2 — QEMU Backend
**Status**: LOCKED
**Goal**: QEMU detection, command building, QMP communication

### 2.1 QEMU Detection Module
**What**: Detect QEMU installation and capabilities
**Dependencies**: 1.5
**Parallelizable**: NO

**Tasks**:
- [ ] Implement QEMU binary detection:
  - Check common paths: /usr/local/bin, /opt/homebrew/bin, etc.
  - Check PATH environment variable
  - Support both "qemu-system-x86_64" and "qemu-system-aarch64"
- [ ] Detect QEMU version (`qemu-system-* --version`)
- [ ] Detect available accelerators:
  - macOS: Check `sysctl kern.hv_support` for HVF
  - Check QEMU output for supported accelerators
- [ ] Create detection report struct
- [ ] Add Tauri command: `detect_qemu() -> DetectionResult`

**Acceptance Criteria**:
- [ ] Detection finds QEMU if installed
- [ ] Returns correct accelerator info on macOS
- [ ] Gracefully handles "QEMU not found"
- [ ] Command works from frontend

**Commit**: `feat: qemu detection`

### 2.2 QEMU Command Builder
**What**: Generate QEMU command lines programmatically
**Dependencies**: 2.1
**Parallelizable**: NO

**Tasks**:
- [ ] Create typed command builder (not string concatenation):
  - `QemuCommand` struct with methods
  - Methods: `.accel()`, `.cpu()`, `.memory()`, `.drive()`, `.netdev()`, `.display()`, etc.
  - Generates `Vec<String>` args or full command string
- [ ] Implement platform-specific defaults:
  - macOS: `-accel hvf` if available
  - Auto-select machine type based on arch
- [ ] Support common devices:
  - VirtIO drives (`-drive if=virtio`)
  - VirtIO network (`-netdev user,id=net0 -device virtio-net-pci,netdev=net0`)
  - SPICE display (`-spice port=5900,disable-ticketing`)
  - USB tablet (`-device usb-tablet`)
- [ ] Add validation (e.g., memory must be power of 2)

**Acceptance Criteria**:
- [ ] Builder produces valid QEMU commands
- [ ] Command includes correct accelerator for platform
- [ ] Commands match expected format (test against manual QEMU)
- [ ] Validation rejects invalid configs

**Commit**: `feat: qemu command builder`

### 2.3 QMP Client
**What**: Implement QEMU Machine Protocol client
**Dependencies**: 2.2
**Parallelizable**: NO

**Tasks**:
- [ ] Implement QMP connection over UNIX socket
- [ ] Implement QMP handshake and capabilities negotiation
- [ ] Implement core commands:
  - `query-status` - Get VM state
  - `system_powerdown` - Graceful shutdown
  - `stop` / `cont` - Pause / resume
  - `quit` - Force stop
  - `query-block` - List drives
  - `blockdev-add` - Add drive
- [ ] Handle QMP events (VM state changes, errors)
- [ ] Add async message handling
- [ ] Create Rust types for QMP messages

**Acceptance Criteria**:
- [ ] Can connect to running QEMU's QMP socket
- [ ] Commands execute successfully
- [ ] Events are received and parsed
- [ ] Connection handles errors gracefully

**Commit**: `feat: qmp client`

### 2.4 VM Process Controller
**What**: Manage QEMU process lifecycle
**Dependencies**: 2.2, 2.3
**Parallelizable**: NO

**Tasks**:
- [ ] Implement process spawning with command builder
- [ ] Create QMP socket for each VM
- [ ] Implement lifecycle methods:
  - `start(vm_config) -> Result<VMHandle>`
  - `stop(vm_id) -> Result<()>`
  - `pause(vm_id) -> Result<()>`
  - `resume(vm_id) -> Result<()>`
- [ ] Implement process monitoring (detect crashes)
- [ ] Handle cleanup on app exit (kill orphaned QEMU)
- [ ] Store PID and socket path for each VM
- [ ] Add Tauri commands for frontend

**Acceptance Criteria**:
- [ ] Can start a VM and get handle back
- [ ] Can stop/pause/resume VM
- [ ] Process cleanup works on exit
- [ ] Frontend can list running VMs

**Commit**: `feat: vm process controller`

---

## Phase 3 — Core VM Logic
**Status**: LOCKED
**Goal**: VM storage, networking, configuration management

### 3.1 Storage Management
**What**: Create and manage VM disk images
**Dependencies**: 2.4
**Parallelizable**: NO

**Tasks**:
- [ ] Define storage directory structure:
  - `~/Library/Application Support/OpenUTM/vms/`
  - Each VM gets subdirectory: `{vm-id}/`
- [ ] Implement qcow2 image creation:
  - Use `qemu-img create -f qcow2`
  - Support resizing
- [ ] Implement ISO mounting/unmounting
- [ ] Track disk usage per VM
- [ ] Add storage operations to Tauri commands

**Acceptance Criteria**:
- [ ] Can create qcow2 disk image
- [ ] Images stored in correct location
- [ ] Can mount ISO file
- [ ] Disk usage tracked accurately

**Commit**: `feat: storage management`

### 3.2 Configuration Store
**What**: Persist VM configurations
**Dependencies**: 2.1
**Parallelizable**: YES (with 3.1)

**Tasks**:
- [ ] Choose storage: SQLite (recommended) or JSON files
- [ ] Implement config database schema:
  - VMs table: id, name, description, created_at, updated_at
  - Configs table: vm_id, cpu_count, memory_mb, arch, accel
  - Drives table: vm_id, path, interface, format
  - Networks table: vm_id, type, config
- [ ] Implement CRUD operations:
  - `create_vm(config) -> VM`
  - `get_vm(id) -> VM`
  - `update_vm(id, config) -> VM`
  - `delete_vm(id)`
  - `list_vms() -> Vec<VM>`
- [ ] Add config validation
- [ ] Add Tauri commands

**Acceptance Criteria**:
- [ ] Config persists across app restarts
- [ ] CRUD operations work from frontend
- [ ] Validation rejects invalid configs
- [ ] SQLite file in Application Support

**Commit**: `feat: configuration store`

### 3.3 VM Core Package (TypeScript)
**What**: High-level VM management in TypeScript
**Dependencies**: 1.4, 3.2
**Parallelizable**: YES (with 3.1)

**Tasks**:
- [ ] Create `packages/vm-core/` package
- [ ] Implement VM service:
  - `VMService` class
  - Methods wrapping Tauri commands
  - Event emitter for VM state changes
- [ ] Implement VM lifecycle:
  - `create(config)`
  - `start(vmId)`
  - `stop(vmId)`
  - `pause(vmId)`
  - `resume(vmId)`
  - `delete(vmId)`
- [ ] Add error handling with typed errors
- [ ] Export service and types

**Acceptance Criteria**:
- [ ] Service methods call Tauri commands
- [ ] State changes emit events
- [ ] Errors are properly typed
- [ ] Can be used by desktop app

**Commit**: `feat: vm core package`

### 3.4 QEMU Library Package
**What**: QEMU abstraction for TypeScript layer
**Dependencies**: 1.4, 2.1
**Parallelizable**: YES (with 3.1, 3.2)

**Tasks**:
- [ ] Create `packages/qemu-lib/` package
- [ ] Implement QEMU detection wrapper:
  - `detectQemu(): Promise<QemuInfo>`
  - Returns version, path, accelerators
- [ ] Implement QEMU installer detection:
  - Homebrew (macOS)
  - APT/DNF (Linux - future)
  - Download option
- [ ] Add version checking (minimum QEMU version)
- [ ] Export all functions

**Acceptance Criteria**:
- [ ] Detects QEMU if installed
- [ ] Returns correct accelerator info
- [ ] Suggests install method if missing
- [ ] Works from desktop app

**Commit**: `feat: qemu lib package`

---

## Phase 4 — UI Implementation
**Status**: LOCKED
**Goal**: Complete desktop application UI

### 4.1 Main Layout
**What**: Application shell with navigation
**Dependencies**: 1.2, 1.3
**Parallelizable**: NO

**Tasks**:
- [ ] Implement sidebar layout (like UTM):
  - VM list with status indicators
  - Add VM button
  - Settings button
- [ ] Implement main content area:
  - VM detail view (empty state initially)
  - Responsive layout
- [ ] Add toolbar with actions:
  - Start, Stop, Pause, Restart buttons
  - VM name/status display
- [ ] Add macOS-style styling
- [ ] Implement dark/light mode support

**Acceptance Criteria**:
- [ ] Layout matches UTM style
- [ ] Sidebar resizable
- [ ] Toolbar shows relevant actions
- [ ] Theme switching works

**Commit**: `feat: main layout`

### 4.2 VM List Sidebar
**What**: List of VMs with status
**Dependencies**: 4.1, 3.3
**Parallelizable**: NO

**Tasks**:
- [ ] Implement VM list component:
  - Show VM name, status icon
  - Running VMs highlighted
  - Sort: running first, then alphabetical
- [ ] Add status indicators:
  - Running (green dot)
  - Stopped (gray)
  - Paused (yellow)
  - Error (red)
- [ ] Add context menu:
  - Start, Stop, Delete options
- [ ] Implement selection (click to view details)
- [ ] Add "Empty state" when no VMs

**Acceptance Criteria**:
- [ ] VMs display with correct status
- [ ] Clicking selects VM
- [ ] Context menu works
- [ ] Empty state shown when appropriate

**Commit**: `feat: vm list sidebar`

### 4.3 Create VM Wizard
**What**: Step-by-step VM creation (like UTM)
**Dependencies**: 3.3, 3.1
**Parallelizable**: NO

**Tasks**:
- [ ] Implement wizard component with steps:
  1. Choose OS type (Linux, Windows, macOS, Other)
  2. Select ISO or use existing
  3. Hardware config (CPU, RAM, Disk)
  4. Network config
  5. Review and create
- [ ] Add OS detection from ISO name
- [ ] Suggest defaults based on OS:
  - Memory: 2GB for Linux, 4GB for Windows
  - CPU: 2 cores
  - Disk: 25GB
- [ ] Add progress indication
- [ ] Handle errors gracefully

**Acceptance Criteria**:
- [ ] Wizard has clear steps
- [ ] OS detection works for common ISOs
- [ ] Suggested defaults are reasonable
- [ ] Can create VM end-to-end

**Commit**: `feat: create vm wizard`

### 4.4 VM Detail View
**What**: Display and edit VM configuration
**Dependencies**: 4.2, 3.3
**Parallelizable**: NO

**Tasks**:
- [ ] Implement VM info panel:
  - Name, description, status
  - Resource usage (if running)
- [ ] Implement settings editor:
  - Hardware tab: CPU, RAM (editable)
  - Drives tab: Add/remove drives
  - Network tab: Configure networking
- [ ] Add start/stop/pause controls
- [ ] Add delete VM button (with confirmation)
- [ ] Show display connection info

**Acceptance Criteria**:
- [ ] Settings persist on edit
- [ ] Controls work (start/stop/pause)
- [ ] Delete shows confirmation dialog
- [ ] Updates reflect in sidebar

**Commit**: `feat: vm detail view`

### 4.5 Display Integration
**What**: Show VM display (SPICE/VNC)
**Dependencies**: 4.4, 2.4
**Parallelizable**: NO

**Tasks**:
- [ ] Research display options:
  - Option A: In-app canvas (complex)
  - Option B: Launch external viewer (simpler)
- [ ] Implement chosen approach:
  - If external: Launch `remote-viewer` or `virt-viewer` with SPICE URL
  - If in-app: Evaluate noVNC or similar
- [ ] Handle display window lifecycle
- [ ] Add "Open Display" button
- [ ] Show display status in UI

**Acceptance Criteria**:
- [ ] Can open VM display
- [ ] Display shows running VM
- [ ] Clipboard shared (if SPICE)
- [ ] Window closes properly

**Commit**: `feat: display integration`

---

## Phase 5 — Integration & Polish
**Status**: LOCKED
**Goal**: End-to-end testing, packaging, distribution prep

### 5.1 QEMU Setup Flow
**What**: Guide user to install QEMU if missing
**Dependencies**: 3.4
**Parallelizable**: NO

**Tasks**:
- [ ] Detect QEMU on startup
- [ ] If missing, show setup wizard:
  - Explain QEMU requirement
  - Option 1: Auto-install via Homebrew (if available)
  - Option 2: Show manual instructions
  - Option 3: Download QEMU binary
- [ ] Test installation flow
- [ ] Add "Check again" button

**Acceptance Criteria**:
- [ ] Detects missing QEMU
- [ ] Setup wizard shows clear options
- [ ] Auto-install works (if brew available)
- [ ] Manual instructions are clear

**Commit**: `feat: qemu setup flow`

### 5.2 Error Handling & Recovery
**What**: Robust error handling throughout
**Dependencies**: All previous
**Parallelizable**: NO

**Tasks**:
- [ ] Add error boundaries in React
- [ ] Implement error toast notifications
- [ ] Handle common failures:
  - QEMU not found
  - VM start fails (show QEMU stderr)
  - Disk full
  - Permission denied
- [ ] Add "View Logs" button for debugging
- [ ] Implement crash recovery (cleanup on restart)

**Acceptance Criteria**:
- [ ] Errors show user-friendly messages
- [ ] Logs accessible for debugging
- [ ] App recovers from crashes
- [ ] No orphaned QEMU processes

**Commit**: `feat: error handling`

### 5.3 macOS Packaging
**What**: Build signed .app bundle
**Dependencies**: 5.1, 5.2
**Parallelizable**: NO

**Tasks**:
- [ ] Configure Tauri bundle settings:
  - App name, identifier
  - Icons (create app icons)
  - Category, copyright
- [ ] Add entitlements:
  - `com.apple.security.hypervisor` (required for HVF)
  - `com.apple.security.network.client`
- [ ] Build release bundle: `bun tauri build`
- [ ] Test bundle on clean macOS
- [ ] Document signing/notarization process (for later)

**Acceptance Criteria**:
- [ ] App bundle runs on target macOS
- [ ] HVF works (check in Activity Monitor)
- [ ] App has proper icon
- [ ] Can be moved to /Applications

**Commit**: `feat: macos packaging`

### 5.4 End-to-End Testing
**What**: Full workflow testing
**Dependencies**: 5.3
**Parallelizable**: NO

**Tasks**:
- [ ] Test complete workflow:
  1. Fresh install
  2. QEMU setup
  3. Create Linux VM
  4. Install OS from ISO
  5. Start/stop/pause VM
  6. Delete VM
- [ ] Test edge cases:
  - Invalid ISO
  - Insufficient disk space
  - Network issues
- [ ] Document any bugs
- [ ] Create test report

**Acceptance Criteria**:
- [ ] Complete workflow succeeds
- [ ] Edge cases handled gracefully
- [ ] No critical bugs
- [ ] Test report documented

**Commit**: `test: e2e testing`

### 5.5 Electron macOS Packaging
**What**: Build Electron .app bundle
**Dependencies**: 5.1, 5.2
**Parallelizable**: YES (with 5.3)

**Tasks**:
- [ ] Configure Electron builder settings
- [ ] Add macOS-specific configuration
- [ ] Build release bundle: `bun electron:build`
- [ ] Test Electron bundle on clean macOS
- [ ] Compare bundle size with Tauri version

**Acceptance Criteria**:
- [ ] Electron app bundle runs on macOS
- [ ] Same features work as Tauri version
- [ ] Bundle size measured and documented
- [ ] App has proper icon

**Commit**: `feat: electron macos packaging`

### 5.6 Framework Comparison & Decision
**What**: Evaluate Tauri vs Electron for OpenUTM
**Dependencies**: 5.3, 5.5
**Parallelizable**: NO

**Tasks**:
- [ ] Measure and document metrics:
  - Bundle size (Tauri ~2.6MB vs Electron ~166MB)
  - Startup time (cold start vs hot start)
  - Memory usage (idle, 1 VM running, 3 VMs running)
  - CPU usage during VM operations
- [ ] Test VM operations on both:
  - Start/stop VM speed
  - Display performance (SPICE responsiveness)
  - File I/O performance (shared folders if implemented)
- [ ] Document developer experience:
  - Build times
  - Debug experience
  - Hot reload speed
- [ ] Create comparison report
- [ ] Make recommendation for primary framework

**Acceptance Criteria**:
- [ ] Metrics collected for both frameworks
- [ ] Comparison report documented in `docs/framework-comparison.md`
- [ ] Clear winner identified with justification
- [ ] Decision recorded in ADR (Architecture Decision Record)

**Commit**: `docs: framework comparison report`

### 5.7 CI/CD Setup
**What**: GitHub Actions for automated testing and releases
**Dependencies**: 5.3, 5.5
**Parallelizable**: NO

**Tasks**:
- [ ] Create `.github/workflows/ci.yml`:
  - Run linting on every PR
  - Run tests on every PR
  - Build both Tauri and Electron on macOS
  - Build Tauri on Linux (future)
- [ ] Create `.github/workflows/release.yml`:
  - Trigger on version tag push
  - Build signed/unsigned binaries
  - Create GitHub release with binaries
  - Generate changelog from commits
- [ ] Setup Tauri updater endpoint (GitHub releases)
- [ ] Setup Electron auto-updater (GitHub releases)
- [ ] Test CI pipeline on test PR
- [ ] Test release workflow with dummy tag

**Acceptance Criteria**:
- [ ] CI runs on every PR
- [ ] Release workflow creates GitHub release
- [ ] Binaries attached to release
- [ ] Tauri updater fetches from GitHub
- [ ] Electron auto-updater works

**Commit**: `ci: github actions workflows`

### 5.8 Telemetry Implementation
**What**: Anonymous usage metrics (opt-in)
**Dependencies**: 5.7
**Parallelizable**: NO

**Tasks**:
- [ ] Create telemetry service (shared package):
  - `packages/telemetry/`
  - Track: VM start/stop counts, feature usage, errors, app version
  - Never track: VM contents, personal data, file names
- [ ] Add opt-in dialog on first launch:
  - Explain what is collected
  - Allow user to enable/disable
  - Link to privacy policy
- [ ] Add telemetry toggle in settings
- [ ] Setup PostHog project (free tier for open source):
  - Create PostHog account
  - Get project API key
  - Configure for anonymous tracking only
  - No personal data, no VM contents
- [ ] Add privacy policy document

**Acceptance Criteria**:
- [ ] First launch shows opt-in dialog
- [ ] Telemetry only sends if user opted in
- [ ] User can disable anytime in settings
- [ ] Data collected matches documented list
- [ ] Privacy policy exists

**Commit**: `feat: opt-in telemetry`

---

## Phase 6 — Expansion (Phase 2+)
**Status**: LOCKED
**Goal**: Linux support, additional features

### 6.1 Linux Backend
**What**: Add KVM support for Linux hosts
**Dependencies**: Phase 5 complete
**Parallelizable**: NO

**Tasks**:
- [ ] Implement Linux platform detector:
  - Check `/dev/kvm` exists
  - Check user in kvm group
- [ ] Implement KVM command builder
- [ ] Test on Ubuntu, Fedora, Arch
- [ ] Add Linux packaging (AppImage, deb, rpm)

**Acceptance Criteria**:
- [ ] Detects KVM on Linux
- [ ] VMs run with KVM acceleration
- [ ] Packages install correctly

### 6.2 Windows Backend
**What**: Add WHPX support for Windows hosts
**Dependencies**: Phase 5 complete
**Parallelizable**: NO

**Tasks**:
- [ ] Implement Windows platform detector:
  - Check Hyper-V / WHPX available
- [ ] Implement WHPX command builder
- [ ] Test on Windows 10/11
- [ ] Add Windows packaging (MSI installer)

**Acceptance Criteria**:
- [ ] Detects WHPX on Windows
- [ ] VMs run with hardware acceleration
- [ ] Installer works

### 6.3 VM Templates Gallery
**What**: Pre-configured VM templates
**Dependencies**: Phase 5 complete
**Parallelizable**: NO

**Tasks**:
- [ ] Create template definitions:
  - Ubuntu LTS
  - Fedora
  - Debian
  - Alpine Linux
- [ ] Add template download:
  - Cloud images (QCOW2)
  - Automatic setup
- [ ] Add template gallery UI
- [ ] One-click template deploy

**Acceptance Criteria**:
- [ ] Templates listed in UI
- [ ] Can deploy from template
- [ ] VMs created correctly

### 6.4 Snapshots
**What**: VM snapshot support
**Dependencies**: 6.1, 6.2
**Parallelizable**: NO

**Tasks**:
- [ ] Implement snapshot commands:
  - Create snapshot
  - List snapshots
  - Restore snapshot
  - Delete snapshot
- [ ] Add snapshot UI
- [ ] Handle qcow2 internal snapshots

**Acceptance Criteria**:
- [ ] Can create snapshot
- [ ] Can restore snapshot
- [ ] UI shows snapshot list

### 6.5 USB Passthrough
**What**: Pass USB devices to VMs
**Dependencies**: 6.1, 6.2
**Parallelizable**: NO

**Tasks**:
- [ ] List host USB devices
- [ ] Add USB device to VM config
- [ ] Hot-plug support
- [ ] USB 3.0 support

**Acceptance Criteria**:
- [ ] USB devices listed
- [ ] Can attach to VM
- [ ] Device works in guest

---

## Development Setup

### Prerequisites
- macOS 12+ (Monterey) for development
- Xcode Command Line Tools
- Bun: `curl -fsSL https://bun.sh/install | bash`
- Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- QEMU: `brew install qemu` (for testing)

### Quick Start
```bash
# Clone repo
git clone <repo-url>
cd openutm

# Install dependencies
bun install

# Run development version
bun tauri dev

# Build release
bun tauri build
```

### Project Commands
- `bun tauri dev` - Run development server
- `bun run build` - Build all packages
- `turbo run lint` - Run linting
- `turbo run test` - Run tests
- `bun tauri build` - Build macOS app

---

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `test`: Tests
- `refactor`: Code refactoring
- `docs`: Documentation
- `chore`: Maintenance

Scopes: `core`, `ui`, `qemu`, `desktop`, `storage`, `config`

---

## Unresolved Questions (Answered)

✅ **Display Protocol**: SPICE (confirmed)
✅ **Code Signing**: No budget - unsigned builds initially
✅ **CI/CD**: GitHub Actions (confirmed, free for public repos)
✅ **Auto-updates**: Tauri updater + electron-updater (confirmed)
✅ **Metrics**: Opt-in telemetry with PostHog (confirmed)
✅ **Framework**: Building BOTH Tauri and Electron for A/B testing
✅ **Telemetry Provider**: PostHog (generous free tier for open source)

## Remaining Open Questions

1. **Cloud VM Integration**: Future feature? (AWS, Azure, GCP)? Say no for now.
2. **Container Support**: Docker/Podman integration alongside VMs? Future phase.
3. **Mobile Version**: iOS/Android companion app? Not in roadmap.

---

## References

### Research Sources
- UTM: https://mac.getutm.app
- Quickemu: https://github.com/quickemu-project/quickemu
- Sqimp (Tauri QEMU UI): https://github.com/RedBe-an/Sqimp
- GNOME Boxes: https://github.com/GNOME/gnome-boxes
- libvirt: https://github.com/libvirt/libvirt
- QEMU QMP: https://wiki.qemu.org/Documentation/QMP
- Tauri: https://tauri.app

### Technical Resources
- macOS Hypervisor.framework: https://developer.apple.com/documentation/hypervisor
- QAPI (QMP Rust): https://github.com/rust-qemu/qapi-rs
- SPICE: https://www.spice-space.org

---

**Plan Version**: 1.0
**Created**: 2026-02-03
**Status**: Phase 1 - In Progress
