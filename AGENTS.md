- In all interactions and commit messages, be extremely concise. Sacrifice grammar for the sake of concision.


## Plan

- At the end of each plan, give me a list of unresolved questions to answer, if any. Make the questions extremely concise. Sacrifice grammar for the sake of concision.


## Approved (plan → build)

When I say **approved** after planning:

**New project (no plan.md yet):**
1. **AGENTS.md** — Append only. Add plan-derived context. Do not remove or rewrite existing content.
2. **plan.md** — Create. Follow structure below (top = full approved plan, bottom = tracking). When designing phases/tasks: see plan.md structure.
3. Push to `main` on my command.
4. Wait for my command ("Go" or equivalent) to execute the plan.

**Existing project (plan.md exists):**
1. **PLAN.md** — Update. New plan: replace entire file with new approved plan + new tracking. Incremental plan: add phases/tasks; mark completed ones.
2. **AGENTS.md** — Update only if plan changes project context (append; never remove existing).
3. Push to `main` on my command.
4. Wait for my command ("Go" or equivalent) to execute the plan.


## plan.md structure

When creating or updating plan.md, use this structure:

**Top (full approved plan):** Paste the full plan I approved — what we're building, context for each phase/task, constraints. Static until the next plan; do not edit this section during execution.
**Bottom (progress tracking):**
- **Phases** — Mandatory sequential. Phase 2 cannot start until Phase 1 is complete. When designing: put work that depends on earlier work in a later phase.
- **Tasks** — Multiple per phase. Optional parallel within a phase: tasks in the same phase are independent by design (can be done in parallel or one-by-one). When designing: put independent work in the same phase so it can run in parallel; put dependent work in different phases.
- **Example Format:**
  ```
  ## Phase 1 — 
  Status: DONE
  - [x] 1.1 
  - [x] 1.2  

  ## Phase 2 —  
  Status: IN PROGRESS
  - [x] 2.1 
  - [ ] 2.2 
  - [ ] 2.3 

  ## Phase 3 — 
  Status: LOCKED
  - [ ] 3.1 
  - [ ] 3.2 

  ```

Critical: When creating the plan.md content, your are responsible for deciding what is serial (phases) and what can be parallel (tasks within a phase). Get phase ordering wrong and work will block or conflict; put dependent tasks in the same phase and parallel execution will break.


## Execution

- Phases sequential; tasks within phase optional parallel (see plan.md structure).
- When asked to work in **Parallel** (multiple tasks in same phase at once): create one worktree per task/branch, then spin up one subagent per task. Each subagent switches into its worktree and implements its assigned task X.Y in the background. When asked to work in **Serial** (one task at a time): do not create worktrees; just create and switch branches as needed.
- When I say "implement task X.Y" or "start phase N": (1) Read plan.md. (2) Your task is the one I name (e.g. "task 1.1"). (3) If parallel execution is active for that phase, handle it via subagents + worktrees as above.

## Git and GitHub

- Your primary method for interacting with GitHub should be GitHub CLI.
- For significant work: create branch, work there, delete branch after merge to main.
- Set up `.gitignore` first (node_modules, .env, etc.).
- Atomic commits; use prefixes (`feat: …`, `test: …`, `fix: …`).


## Dev Environment

- Prefer bun wherever possible.
- Follow TDD: write tests first, then implement.
- Make sure to have 100% code coverage with sensible tests.


## Testing Discipline

- Use TDD for everything: bugs, refactors, and new features.
- Start with a failing test that captures the expected behavior and edge cases.
- For new features, begin with CLI-level tests (flags, output, errors) and add unit tests for core logic.
- Verify the test fails for the right reason before implementing; keep tests green incrementally.
- Run the app yourself and use it to verify behavior; close the loop (don't rely only on automated tests).

---

## Project: OpenUTM

**Vision**: Cross-platform, open source UTM alternative. Easy hypervisor for everybody to have a mini computer inside their computer.

**Tech Stack**:
- **Frontends**: BOTH Tauri (Rust) AND Electron (Node.js) for A/B testing
- **Shared**: React + TypeScript, Turborepo + Bun
- **Backend**: Direct QEMU control via QMP (not libvirt)
- **Display**: SPICE protocol
- **CI/CD**: GitHub Actions (free for public repos)
- **Telemetry**: PostHog (opt-in, free tier for open source)

**Platform Strategy**:
- **Phase 1**: macOS first (HVF accelerator)
- **Phase 2**: Linux (KVM)
- **Phase 3**: Windows (WHPX)

**Target User**: General consumers (VirtualBox replacement)

**QEMU Strategy**: Auto-detect system QEMU; in-app download if missing (no bundling)

**Architecture**: Monorepo with shared packages
- apps/tauri/ + apps/electron/
- packages/ui/, packages/vm-core/, packages/qemu-lib/, packages/shared-types/

**Key Patterns**:
- UTM-like UI: sidebar, wizard-based setup, configuration inspector
- Quickemu-inspired: auto-detect accelerators, typed command builder
- Direct QEMU: QMP for control, not libvirt (weak cross-platform support)

**Guardrails**:
- NO code signing initially (unsigned builds, will show warnings)
- NO GPU passthrough in MVP
- NO macOS guest support initially
- NO live migration
- Start single-platform (macOS), expand later

**Framework Comparison**: Building both Tauri and Electron to empirically test which performs better for VM management
- Tauri: 2.6MB bundle, ~310MB memory, native Rust backend
- Electron: 166MB bundle, ~460MB memory, massive ecosystem

**Display Protocol**: SPICE (integrated in app window, clipboard/audio sharing, dynamic resolution)

**Budget**: No money for code signing initially. GitHub Actions free for public repos. PostHog free tier for telemetry.

**References**:
- UTM: https://mac.getutm.app
- Quickemu: https://github.com/quickemu-project/quickemu
- Tauri: https://tauri.app
- QMP: https://wiki.qemu.org/Documentation/QMP
- PostHog: https://posthog.com
