import React from 'react';

export type VMStatus = 'running' | 'stopped' | 'paused' | 'error';

export interface VMListItem {
  id: string;
  name: string;
  status: VMStatus;
  os: string;
}

export interface VMListSidebarProps {
  vms: VMListItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onContextMenu: (id: string, action: 'start' | 'stop' | 'delete') => void;
}

const statusDotColors: Record<VMStatus, string> = {
  running: 'bg-green-500',
  stopped: 'bg-gray-400',
  paused: 'bg-yellow-500',
  error: 'bg-red-500',
};

const statusLabels: Record<VMStatus, string> = {
  running: 'Running',
  stopped: 'Stopped',
  paused: 'Paused',
  error: 'Error',
};

export const VMListSidebar: React.FC<VMListSidebarProps> = ({
  vms,
  selectedId,
  onSelect,
  onContextMenu,
}) => {
  const sortedVMs = [...vms].sort((a, b) => {
    const runningPriority = Number(a.status !== 'running') - Number(b.status !== 'running');
    if (runningPriority !== 0) return runningPriority;
    return a.name.localeCompare(b.name);
  });

  const handleContextMenu = (e: React.MouseEvent, vm: VMListItem) => {
    e.preventDefault();
    const action = vm.status === 'running' ? 'stop' : 'start';
    onContextMenu(vm.id, action);
  };

  if (vms.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500 mb-2">No VMs found</p>
        <p className="text-sm text-gray-400">Create a new virtual machine to get started</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1 p-2" role="list">
      {sortedVMs.map((vm) => (
        <li
          key={vm.id}
          role="listitem"
          onClick={() => onSelect(vm.id)}
          onContextMenu={(e) => handleContextMenu(e, vm)}
          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
            selectedId === vm.id
              ? 'bg-blue-100 dark:bg-blue-900'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <div className={`w-3 h-3 rounded-full ${statusDotColors[vm.status]}`} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{vm.name}</p>
            <p className="text-xs text-gray-500">{statusLabels[vm.status]}</p>
          </div>
        </li>
      ))}
    </ul>
  );
};
