import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VMDetailView } from './VMDetailView';
import { DisplayProtocol, DisplaySessionStatus, VM, VMStatus } from '@openutm/shared-types';

const mockVM: VM = {
  id: 'test-vm-1',
  name: 'Test VM',
  status: VMStatus.Stopped,
  config: {
    cpu: 2,
    memory: 4096,
    disks: [
      { path: '/tmp/disk.qcow2', size: 1024 * 1024 * 1024 * 20, format: 'qcow2' }
    ],
    network: { type: 'nat' },
    installMediaPath: null,
    bootOrder: 'disk-first',
    networkType: 'nat',
  }
};

describe('VMDetailView', () => {
  const displaySession = {
    vmId: mockVM.id,
    protocol: DisplayProtocol.Spice,
    host: '127.0.0.1',
    port: 5901,
    uri: 'spice://127.0.0.1:5901',
    status: DisplaySessionStatus.Connected,
    reconnectAttempts: 1,
  };

  it('displays VM info correctly', () => {
    render(
      <VMDetailView 
        vm={mockVM} 
        onUpdateConfig={vi.fn()} 
        onAction={vi.fn()} 
        onDelete={vi.fn()} 
      />
    );
    
    expect(screen.getByText('Test VM')).toBeDefined();
    expect(screen.getByText('Stopped')).toBeDefined();
    expect(screen.getByText('2 vCPU')).toBeDefined();
    expect(screen.getByText('4096 MB RAM')).toBeDefined();
  });

  it('shows resource usage when running', () => {
    const runningVM = { ...mockVM, status: VMStatus.Running };
    const stats = { cpu: 45, memory: 2048 };
    
    render(
      <VMDetailView 
        vm={runningVM} 
        stats={stats}
        onUpdateConfig={vi.fn()} 
        onAction={vi.fn()} 
        onDelete={vi.fn()} 
      />
    );
    
    expect(screen.getByText('45%')).toBeDefined();
    expect(screen.getByText('2048 MB')).toBeDefined();
  });

  it('calls onAction when controls are clicked', () => {
    const onAction = vi.fn();
    render(
      <VMDetailView 
        vm={mockVM} 
        onUpdateConfig={vi.fn()} 
        onAction={onAction} 
        onDelete={vi.fn()} 
      />
    );
    
    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);
    expect(onAction).toHaveBeenCalledWith(mockVM.id, 'start');
  });

  it('switches tabs and allows editing settings', async () => {
    const onUpdateConfig = vi.fn();
    render(
      <VMDetailView 
        vm={mockVM} 
        onUpdateConfig={onUpdateConfig} 
        onAction={vi.fn()} 
        onDelete={vi.fn()} 
      />
    );
    
    const hardwareTab = screen.getByText('Hardware');
    fireEvent.click(hardwareTab);
    
    const cpuInput = screen.getByLabelText('CPU Cores');
    fireEvent.change(cpuInput, { target: { value: '4' } });

    const memoryInput = screen.getByLabelText('Memory (MB)');
    fireEvent.change(memoryInput, { target: { value: '8192' } });
    
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);
    
    expect(onUpdateConfig).toHaveBeenCalledWith(mockVM.id, expect.objectContaining({
      cpu: 4,
      memory: 8192,
    }));
  });

  it('shows delete confirmation', async () => {
    const onDelete = vi.fn();
    render(
      <VMDetailView 
        vm={mockVM} 
        onUpdateConfig={vi.fn()} 
        onAction={vi.fn()} 
        onDelete={onDelete} 
      />
    );
    
    const deleteButton = screen.getByText('Delete VM');
    fireEvent.click(deleteButton);
    
    expect(screen.getByText('Are you sure?')).toBeDefined();
    
    const confirmButton = screen.getByText('Confirm Delete');
    fireEvent.click(confirmButton);
    
    expect(onDelete).toHaveBeenCalledWith(mockVM.id);
  });

  it('shows running actions and triggers stop/pause', () => {
    const onAction = vi.fn();
    render(
      <VMDetailView
        vm={{ ...mockVM, status: VMStatus.Running }}
        onUpdateConfig={vi.fn()}
        onAction={onAction}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Stop'));
    fireEvent.click(screen.getByText('Pause'));
    expect(onAction).toHaveBeenCalledWith(mockVM.id, 'stop');
    expect(onAction).toHaveBeenCalledWith(mockVM.id, 'pause');
  });

  it('shows paused action and triggers resume', () => {
    const onAction = vi.fn();
    render(
      <VMDetailView
        vm={{ ...mockVM, status: VMStatus.Paused }}
        onUpdateConfig={vi.fn()}
        onAction={onAction}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Resume'));
    expect(onAction).toHaveBeenCalledWith(mockVM.id, 'resume');
  });

  it('renders drives and network tabs', () => {
    render(
      <VMDetailView
        vm={mockVM}
        onUpdateConfig={vi.fn()}
        onAction={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Drives'));
    expect(screen.getByText('/tmp/disk.qcow2')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Network'));
    expect(screen.getByText('Type: nat')).toBeInTheDocument();
  });

  it('handles install media actions from drives tab', () => {
    const onPickInstallMedia = vi.fn();
    const onEjectInstallMedia = vi.fn();
    const onSetBootOrder = vi.fn();
    render(
      <VMDetailView
        vm={{
          ...mockVM,
          config: {
            ...mockVM.config,
            installMediaPath: '/isos/ubuntu.iso',
          },
        }}
        onPickInstallMedia={onPickInstallMedia}
        onEjectInstallMedia={onEjectInstallMedia}
        onSetBootOrder={onSetBootOrder}
        onUpdateConfig={vi.fn()}
        onAction={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Drives'));
    fireEvent.click(screen.getByRole('button', { name: 'Pick ISO' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eject ISO' }));
    fireEvent.click(screen.getByRole('button', { name: 'Boot Disk First' }));
    fireEvent.click(screen.getByRole('button', { name: 'Boot ISO First' }));

    expect(onPickInstallMedia).toHaveBeenCalledWith(mockVM.id);
    expect(onEjectInstallMedia).toHaveBeenCalledWith(mockVM.id);
    expect(onSetBootOrder).toHaveBeenCalledWith(mockVM.id, 'disk-first');
    expect(onSetBootOrder).toHaveBeenCalledWith(mockVM.id, 'cdrom-first');
  });

  it('disables iso actions when install media is missing', () => {
    render(
      <VMDetailView
        vm={mockVM}
        onPickInstallMedia={vi.fn()}
        onEjectInstallMedia={vi.fn()}
        onSetBootOrder={vi.fn()}
        onUpdateConfig={vi.fn()}
        onAction={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Drives'));
    expect(screen.getByRole('button', { name: 'Eject ISO' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Boot ISO First' })).toBeDisabled();
  });

  it('cancels delete confirmation modal', () => {
    const onDelete = vi.fn();
    render(
      <VMDetailView
        vm={mockVM}
        onUpdateConfig={vi.fn()}
        onAction={vi.fn()}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByText('Delete VM'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('opens and closes display session from display tab', () => {
    const onOpenDisplay = vi.fn();
    const onCloseDisplay = vi.fn();
    render(
      <VMDetailView
        vm={{ ...mockVM, status: VMStatus.Running }}
        displaySession={displaySession}
        onOpenDisplay={onOpenDisplay}
        onCloseDisplay={onCloseDisplay}
        onUpdateConfig={vi.fn()}
        onAction={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Display'));
    expect(screen.getByText('Endpoint: spice://127.0.0.1:5901')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open display/i }));
    fireEvent.click(screen.getByText('Close Display'));
    expect(onOpenDisplay).toHaveBeenCalledWith(mockVM.id);
    expect(onCloseDisplay).toHaveBeenCalledWith(mockVM.id);
  });

  it('disables start and open display actions when runtime gate is active', () => {
    const onAction = vi.fn();
    const onOpenDisplay = vi.fn();
    render(
      <VMDetailView
        vm={mockVM}
        onOpenDisplay={onOpenDisplay}
        onCloseDisplay={vi.fn()}
        onUpdateConfig={vi.fn()}
        onAction={onAction}
        onDelete={vi.fn()}
        disableStart
        disableStartReason="Install OpenUTM Runtime"
        disableDisplayOpen
        disableDisplayOpenReason="Install OpenUTM Runtime"
      />
    );

    const startButton = screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement;
    expect(startButton.disabled).toBe(true);
    expect(startButton.title).toBe('Install OpenUTM Runtime');

    fireEvent.click(screen.getByText('Display'));
    const openDisplayButton = screen.getByRole('button', { name: /open display/i }) as HTMLButtonElement;
    expect(openDisplayButton.disabled).toBe(true);
    expect(openDisplayButton.title).toBe('Install OpenUTM Runtime');

    expect(onAction).not.toHaveBeenCalled();
    expect(onOpenDisplay).not.toHaveBeenCalled();
  });

  it('shows empty display state when no session exists', () => {
    render(
      <VMDetailView
        vm={{ ...mockVM, status: VMStatus.Running }}
        onOpenDisplay={vi.fn()}
        onCloseDisplay={vi.fn()}
        onUpdateConfig={vi.fn()}
        onAction={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Display'));
    expect(screen.getByText('No active display session.')).toBeInTheDocument();
  });

  it('renders custom display body when provided', () => {
    render(
      <VMDetailView
        vm={{ ...mockVM, status: VMStatus.Running }}
        displayBody={<p>Embedded Display Canvas</p>}
        onOpenDisplay={vi.fn()}
        onCloseDisplay={vi.fn()}
        onUpdateConfig={vi.fn()}
        onAction={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Display'));
    expect(screen.getByText('Embedded Display Canvas')).toBeInTheDocument();
  });

  it('shows display last error and disables close when disconnected', () => {
    const onCloseDisplay = vi.fn();
    render(
      <VMDetailView
        vm={{ ...mockVM, status: VMStatus.Running }}
        displaySession={{
          ...displaySession,
          status: DisplaySessionStatus.Disconnected,
          lastError: 'socket dropped',
        }}
        onOpenDisplay={vi.fn()}
        onCloseDisplay={onCloseDisplay}
        onUpdateConfig={vi.fn()}
        onAction={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Display'));
    expect(screen.getByText('Last error: socket dropped')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close Display' })).toBeDisabled();
    expect(onCloseDisplay).not.toHaveBeenCalled();
  });
});
