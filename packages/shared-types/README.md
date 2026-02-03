# @openutm/shared-types

Shared TypeScript type definitions and Zod validation schemas for OpenUTM.

## Features

- **Core Types**: VM, VMConfig, Disk, NetworkConfig, Platform, Accelerator enums
- **Zod Schemas**: Runtime validation for all types
- **Type Inference**: Auto-generated types from schemas using `z.infer<>`
- **Tree-shakeable**: Both type and schema exports

## Installation

```bash
bun install @openutm/shared-types
```

## Usage

### Types Only

```typescript
import { VM, VMStatus, Platform } from '@openutm/shared-types';

const vm: VM = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Ubuntu 22.04',
  status: VMStatus.Stopped,
  config: {
    cpu: 4,
    memory: 8192,
    disks: [
      {
        path: '/vms/ubuntu.qcow2',
        size: 1073741824,
        format: 'qcow2',
      },
    ],
    network: { type: 'nat' },
  },
};
```

### Validation with Zod

```typescript
import { VMSchema } from '@openutm/shared-types';

const data = { /* from API */ };
const vm = VMSchema.parse(data); // throws on invalid data
const vmSafe = VMSchema.safeParse(data); // returns { success, data, error }
```

### Type Inference from Schemas

```typescript
import { VMSchema, type ValidatedVM } from '@openutm/shared-types';

// ValidatedVM is automatically inferred from VMSchema
const vm: ValidatedVM = VMSchema.parse(apiResponse);
```

## Available Exports

### Enums

- `Platform`: macOS, Linux, Windows
- `Accelerator`: HVF, KVM, WHPX, TCG
- `VMStatus`: Stopped, Running, Paused, Error

### Types

- `Disk`
- `NetworkConfig`
- `VMConfig`
- `VM`
- `SystemInfo`

### Schemas

All schemas are exported individually and correspond 1:1 to types:

- `DiskSchema`
- `NetworkConfigSchema`
- `VMConfigSchema`
- `VMSchema`
- `SystemInfoSchema`
- `PlatformSchema`
- `AcceleratorSchema`
- `VMStatusSchema`

### Validated Types

Auto-inferred types from schemas for type safety:

- `ValidatedDisk`
- `ValidatedNetworkConfig`
- `ValidatedVMConfig`
- `ValidatedVM`
- `ValidatedSystemInfo`

## Dual Exports

The package provides two export points:

```typescript
// Main export (types + schemas)
import { VM, VMSchema } from '@openutm/shared-types';

// Schemas only (if you want to minimize bundle size)
import { VMSchema } from '@openutm/shared-types/schemas';
```

## Testing

```bash
bun run test
```

All schemas include validation tests for:
- Valid data structures
- Edge cases (zero values, empty fields)
- Invalid formats and types
- Range constraints (positive numbers)
- UUID validation for IDs
