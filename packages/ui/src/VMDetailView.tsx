import React, { useState } from 'react';
import { VM, VMStatus } from '@openutm/shared-types';
import type { DisplaySession } from '@openutm/shared-types';
import { Button } from './Button';
import { DisplayControl } from './DisplayControl';
import { Input } from './Input';
import { VMStatusBadge } from './VMStatusBadge';

export interface VMDetailViewProps {
  vm: VM;
  stats?: { cpu: number; memory: number };
  onUpdateConfig: (id: string, config: any) => void;
  onAction: (id: string, action: 'start' | 'stop' | 'pause' | 'resume' | 'shutdown') => void;
  onDelete: (id: string) => void;
  onOpenDisplay?: (id: string) => void;
  onCloseDisplay?: (id: string) => void;
  displaySession?: DisplaySession | null;
}

type Tab = 'overview' | 'hardware' | 'drives' | 'network' | 'display';

export const VMDetailView: React.FC<VMDetailViewProps> = ({
  vm,
  stats,
  onUpdateConfig,
  onAction,
  onDelete,
  onOpenDisplay,
  onCloseDisplay,
  displaySession = null,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editConfig, setEditConfig] = useState({
    cpu: vm.config.cpu,
    memory: vm.config.memory,
  });

  const statusMap: Record<VMStatus, string> = {
    [VMStatus.Stopped]: 'stopped',
    [VMStatus.Running]: 'running',
    [VMStatus.Paused]: 'paused',
    [VMStatus.Error]: 'error',
  };

  const handleSaveHardware = () => {
    onUpdateConfig(vm.id, { cpu: editConfig.cpu, memory: editConfig.memory });
  };

  const renderOverview = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500">CPU</p>
          <p className="font-medium">{vm.config.cpu} vCPU</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Memory</p>
          <p className="font-medium">{vm.config.memory} MB RAM</p>
        </div>
      </div>
      {stats && vm.status === VMStatus.Running && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm text-gray-500">CPU Usage</p>
            <p className="font-medium">{stats.cpu}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Memory Usage</p>
            <p className="font-medium">{stats.memory} MB</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderHardware = () => (
    <div className="space-y-4">
      <Input
        label="CPU Cores"
        type="number"
        value={editConfig.cpu}
        onChange={(e) => setEditConfig({ ...editConfig, cpu: parseInt(e.target.value) })}
      />
      <Input
        label="Memory (MB)"
        type="number"
        value={editConfig.memory}
        onChange={(e) => setEditConfig({ ...editConfig, memory: parseInt(e.target.value) })}
      />
      <Button onClick={handleSaveHardware}>Save Changes</Button>
    </div>
  );

  const renderDrives = () => (
    <div className="space-y-2">
      {vm.config.disks.map((disk, idx) => (
        <div key={idx} className="p-3 border rounded-lg">
          <p className="font-medium">Disk {idx + 1}</p>
          <p className="text-sm text-gray-500">{disk.path}</p>
          <p className="text-sm text-gray-500">{(disk.size / 1024 / 1024 / 1024).toFixed(1)} GB ({disk.format})</p>
        </div>
      ))}
    </div>
  );

  const renderNetwork = () => (
    <div className="space-y-4">
      <div className="p-3 border rounded-lg">
        <p className="font-medium">Network Configuration</p>
        <p className="text-sm text-gray-500">Type: {vm.config.network.type}</p>
      </div>
    </div>
  );

  const renderDisplay = () => (
    <div className="space-y-4">
      <DisplayControl onOpenDisplay={() => onOpenDisplay?.(vm.id)} status={vm.status} />
      {displaySession ? (
        <div className="p-3 border rounded-lg space-y-2">
          <p className="font-medium">Session</p>
          <p className="text-sm text-gray-500">Protocol: {displaySession.protocol}</p>
          <p className="text-sm text-gray-500">Endpoint: {displaySession.uri}</p>
          <p className="text-sm text-gray-500">Status: {displaySession.status}</p>
          <p className="text-sm text-gray-500">Reconnect attempts: {displaySession.reconnectAttempts}</p>
          {displaySession.lastError ? (
            <p className="text-sm text-red-600">Last error: {displaySession.lastError}</p>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => onCloseDisplay?.(vm.id)}
            disabled={displaySession.status === 'disconnected'}
          >
            Close Display
          </Button>
        </div>
      ) : (
        <div className="p-3 border rounded-lg">
          <p className="text-sm text-gray-500">No active display session.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{vm.name}</h1>
          <div className="mt-2">
            <VMStatusBadge status={statusMap[vm.status] as any} />
          </div>
        </div>
        <div className="flex gap-2">
          {vm.status === VMStatus.Stopped && (
            <Button onClick={() => onAction(vm.id, 'start')}>Start</Button>
          )}
          {vm.status === VMStatus.Running && (
            <>
              <Button onClick={() => onAction(vm.id, 'stop')}>Stop</Button>
              <Button onClick={() => onAction(vm.id, 'pause')}>Pause</Button>
            </>
          )}
          {vm.status === VMStatus.Paused && (
            <Button onClick={() => onAction(vm.id, 'resume')}>Resume</Button>
          )}
          <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>Delete VM</Button>
        </div>
      </div>

      <div className="border-b">
        <nav className="flex gap-4">
          {(['overview', 'hardware', 'drives', 'network', 'display'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-4 ${
                activeTab === tab
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      <div className="py-4">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'hardware' && renderHardware()}
        {activeTab === 'drives' && renderDrives()}
        {activeTab === 'network' && renderNetwork()}
        {activeTab === 'display' && renderDisplay()}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-2">Are you sure?</h2>
            <p className="text-gray-600 mb-4">
              This will permanently delete &quot;{vm.name}&quot; and all its data.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  onDelete(vm.id);
                  setShowDeleteConfirm(false);
                }}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
