import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VMListSidebar, VMListSidebarProps } from './VMListSidebar';

describe('VMListSidebar', () => {
  const mockVMs: VMListSidebarProps['vms'] = [
    { id: '1', name: 'Windows 11', status: 'running', os: 'windows' },
    { id: '2', name: 'Ubuntu 22.04', status: 'stopped', os: 'linux' },
    { id: '3', name: 'macOS Sequoia', status: 'paused', os: 'macos' },
    { id: '4', name: 'Arch Linux', status: 'error', os: 'linux' },
  ];

  const mockOnSelect = vi.fn();
  const mockOnContextMenu = vi.fn();

  it('renders a list of VMs', () => {
    render(
      <VMListSidebar
        vms={mockVMs}
        onSelect={mockOnSelect}
        onContextMenu={mockOnContextMenu}
      />
    );

    expect(screen.getByText('Windows 11')).toBeDefined();
    expect(screen.getByText('Ubuntu 22.04')).toBeDefined();
    expect(screen.getByText('macOS Sequoia')).toBeDefined();
    expect(screen.getByText('Arch Linux')).toBeDefined();
  });

  it('sorts VMs: running first, then alphabetical', () => {
    render(
      <VMListSidebar
        vms={mockVMs}
        onSelect={mockOnSelect}
        onContextMenu={mockOnContextMenu}
      />
    );

    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Windows 11');
    expect(items[1].textContent).toContain('Arch Linux');
    expect(items[2].textContent).toContain('macOS Sequoia');
    expect(items[3].textContent).toContain('Ubuntu 22.04');
  });

  it('highlights the selected VM', () => {
    render(
      <VMListSidebar
        vms={mockVMs}
        selectedId="2"
        onSelect={mockOnSelect}
        onContextMenu={mockOnContextMenu}
      />
    );

    const selectedItem = screen.getByText('Ubuntu 22.04').closest('li');
    expect(selectedItem?.className).toContain('bg-blue-100'); // Or whatever active class
  });

  it('calls onSelect when a VM is clicked', () => {
    render(
      <VMListSidebar
        vms={mockVMs}
        onSelect={mockOnSelect}
        onContextMenu={mockOnContextMenu}
      />
    );

    fireEvent.click(screen.getByText('macOS Sequoia'));
    expect(mockOnSelect).toHaveBeenCalledWith('3');
  });

  it('calls onContextMenu when a VM is right-clicked (mock)', () => {
    render(
      <VMListSidebar
        vms={mockVMs}
        onSelect={mockOnSelect}
        onContextMenu={mockOnContextMenu}
      />
    );

    fireEvent.contextMenu(screen.getByText('Windows 11'));
    expect(mockOnContextMenu).toHaveBeenCalledWith('1', 'stop');
  });

  it('uses start action in context menu for non-running VM', () => {
    render(
      <VMListSidebar
        vms={mockVMs}
        onSelect={mockOnSelect}
        onContextMenu={mockOnContextMenu}
      />
    );

    fireEvent.contextMenu(screen.getByText('Ubuntu 22.04'));
    expect(mockOnContextMenu).toHaveBeenCalledWith('2', 'start');
  });

  it('shows empty state when no VMs', () => {
    render(
      <VMListSidebar
        vms={[]}
        onSelect={mockOnSelect}
        onContextMenu={mockOnContextMenu}
      />
    );

    expect(screen.getByText(/No VMs found/i)).toBeDefined();
    expect(screen.getByText(/Create a new virtual machine/i)).toBeDefined();
  });
});
