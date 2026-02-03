# OpenUTM

Cross-platform, open source UTM alternative. Easy hypervisor for everybody to have a mini computer inside their computer.

## Tech Stack

- **Monorepo**: Turborepo + Bun
- **Frontends**: Tauri (Rust) + Electron (Node.js) for A/B testing
- **UI Framework**: React + TypeScript
- **Backend**: Direct QEMU control via QMP
- **Display**: SPICE protocol
- **Telemetry**: PostHog (opt-in)

## Project Structure

```
openutm/
├── apps/
│   ├── tauri/          # Tauri desktop app (Rust backend)
│   └── electron/       # Electron desktop app (Node.js backend)
├── packages/
│   ├── ui/             # Shared React components
│   ├── vm-core/        # VM management logic
│   ├── qemu-lib/       # QEMU QMP abstraction
│   ├── shared-types/   # TypeScript type definitions
│   └── telemetry/      # PostHog integration
├── package.json        # Root workspace config
└── turbo.json          # Turborepo pipeline
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- Node.js 20+ (for development tooling)
- QEMU installed locally (auto-detected at runtime)

### Installation

```bash
# Install dependencies
bun install

# Start development servers (all workspaces)
bun run dev

# Build all packages
bun run build

# Run linters
bun run lint

# Run tests
bun run test

# Run type checking
bun run typecheck
```

## Turborepo Pipeline

- **build**: Builds all packages (respects dependencies)
- **dev**: Starts dev servers (persistent, no caching)
- **lint**: Runs linters across all packages
- **test**: Runs test suites
- **typecheck**: TypeScript type checking

## Platform Strategy

Phase 1: macOS (HVF accelerator)
Phase 2: Linux (KVM)
Phase 3: Windows (WHPX)

## References

- [UTM](https://mac.getutm.app)
- [Quickemu](https://github.com/quickemu-project/quickemu)
- [Tauri Docs](https://tauri.app)
- [QEMU QMP Docs](https://wiki.qemu.org/Documentation/QMP)

## License

MIT
