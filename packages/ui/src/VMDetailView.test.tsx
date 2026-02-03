import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VMDetailView } from './VMDetailView';
import { VM, VMStatus, Platform, Accelerator } from '@openutm/shared-types';

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
    network: { type: 'nat' }
  }
};

describe('VMDetailView', () => {
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
    
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);
    
    expect(onUpdateConfig).toHaveBeenCalledWith(mockVM.id, expect.objectContaining({
      cpu: 4
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
});
