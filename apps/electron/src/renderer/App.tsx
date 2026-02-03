import { useState, useCallback, useEffect } from 'react';
import { VMStatus } from '@openutm/shared-types';
import type { VM } from '@openutm/shared-types';
import {
  MainLayout,
  VMListSidebar,
  VMDetailView,
  VMWizard,
  Button,
  QemuSetupWizard,
  useToast,
  type VMListItem,
  type QemuDetectionResult,
} from '@openutm/ui';
import './index.css';

const vmStatusToListStatus = (status: VMStatus): VMListItem['status'] => {
  const map: Record<VMStatus, VMListItem['status']> = {
    [VMStatus.Running]: 'running',
    [VMStatus.Stopped]: 'stopped',
    [VMStatus.Paused]: 'paused',
    [VMStatus.Error]: 'error',
  };
  return map[status];
};

const MOCK_VMS: VM[] = [
  {
    id: '1',
    name: 'Ubuntu 22.04',
    status: VMStatus.Running,
    config: {
      cpu: 4,
      memory: 8192,
      disks: [{ path: '/vms/ubuntu.qcow2', size: 53687091200, format: 'qcow2' }],
      network: { type: 'nat' },
    },
  },
  {
    id: '2',
    name: 'Windows 11',
    status: VMStatus.Stopped,
    config: {
      cpu: 4,
      memory: 16384,
      disks: [{ path: '/vms/win11.qcow2', size: 107374182400, format: 'qcow2' }],
      network: { type: 'nat' },
    },
  },
  {
    id: '3',
    name: 'Fedora 39',
    status: VMStatus.Paused,
    config: {
      cpu: 2,
      memory: 4096,
      disks: [{ path: '/vms/fedora.qcow2', size: 32212254720, format: 'qcow2' }],
      network: { type: 'nat' },
    },
  },
];

type AppState = 'loading' | 'qemu-setup' | 'ready';

const DEFAULT_INSTALL_SUGGESTION = `macOS: Install QEMU using Homebrew:
  brew install qemu

Alternatively, download from: https://www.qemu.org/download/#macos`;

function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [qemuResult, setQemuResult] = useState<QemuDetectionResult | null>(null);
  const [vms, setVms] = useState<VM[]>(MOCK_VMS);
  const [selectedId, setSelectedId] = useState<string | undefined>(MOCK_VMS[0]?.id);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const { addToast } = useToast();

  const checkQemu = useCallback(async () => {
    setAppState('loading');
    try {
      const result: QemuDetectionResult = {
        available: true,
        path: '/opt/homebrew/bin/qemu-system-aarch64',
        version: 'QEMU emulator version 8.2.0',
        accelerators: ['hvf', 'tcg'],
        minimumVersionMet: true,
      };
      setQemuResult(result);
      if (result.available && result.minimumVersionMet) {
        setAppState('ready');
      } else {
        setAppState('qemu-setup');
      }
    } catch (error) {
      setQemuResult({
        available: false,
        path: null,
        version: null,
        accelerators: [],
        minimumVersionMet: false,
      });
      setAppState('qemu-setup');
      addToast('error', 'Failed to detect QEMU installation');
    }
  }, [addToast]);

  useEffect(() => {
    checkQemu();
  }, [checkQemu]);

  const selectedVm = vms.find((vm) => vm.id === selectedId);

  const vmListItems: VMListItem[] = vms.map((vm) => ({
    id: vm.id,
    name: vm.name,
    status: vmStatusToListStatus(vm.status),
    os: 'Linux',
  }));

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setShowWizard(false);
  }, []);

  const handleContextMenu = useCallback(
    (id: string, action: 'start' | 'stop' | 'delete') => {
      const vm = vms.find((v) => v.id === id);
      const vmName = vm?.name || 'VM';
      
      if (action === 'delete') {
        setVms((prev) => prev.filter((vm) => vm.id !== id));
        if (selectedId === id) {
          setSelectedId(vms[0]?.id);
        }
        addToast('success', `${vmName} deleted`);
        return;
      }

      setVms((prev) =>
        prev.map((vm) => {
          if (vm.id !== id) return vm;
          const newStatus = action === 'start' ? VMStatus.Running : VMStatus.Stopped;
          return { ...vm, status: newStatus };
        })
      );
      addToast('success', `${vmName} ${action === 'start' ? 'started' : 'stopped'}`);
    },
    [selectedId, vms, addToast]
  );

  const handleAction = useCallback(
    (id: string, action: 'start' | 'stop' | 'pause' | 'resume' | 'shutdown') => {
      const vm = vms.find((v) => v.id === id);
      const vmName = vm?.name || 'VM';
      
      setVms((prev) =>
        prev.map((vm) => {
          if (vm.id !== id) return vm;
          let newStatus = vm.status;
          switch (action) {
            case 'start':
              newStatus = VMStatus.Running;
              break;
            case 'stop':
            case 'shutdown':
              newStatus = VMStatus.Stopped;
              break;
            case 'pause':
              newStatus = VMStatus.Paused;
              break;
            case 'resume':
              newStatus = VMStatus.Running;
              break;
          }
          return { ...vm, status: newStatus };
        })
      );
      
      const actionLabels: Record<typeof action, string> = {
        start: 'started',
        stop: 'stopped',
        pause: 'paused',
        resume: 'resumed',
        shutdown: 'shut down',
      };
      addToast('success', `${vmName} ${actionLabels[action]}`);
    },
    [vms, addToast]
  );

  const handleUpdateConfig = useCallback((id: string, config: Partial<VM['config']>) => {
    setVms((prev) =>
      prev.map((vm) => {
        if (vm.id !== id) return vm;
        return { ...vm, config: { ...vm.config, ...config } };
      })
    );
    addToast('info', 'Configuration updated');
  }, [addToast]);

  const handleDelete = useCallback(
    (id: string) => {
      const vm = vms.find((v) => v.id === id);
      const vmName = vm?.name || 'VM';
      setVms((prev) => prev.filter((vm) => vm.id !== id));
      if (selectedId === id) {
        setSelectedId(vms.find((vm) => vm.id !== id)?.id);
      }
      addToast('success', `${vmName} deleted`);
    },
    [selectedId, vms, addToast]
  );

  const handleWizardComplete = useCallback((wizardConfig: any) => {
    const newVm: VM = {
      id: String(Date.now()),
      name: `${wizardConfig.os.charAt(0).toUpperCase() + wizardConfig.os.slice(1)} VM`,
      status: VMStatus.Stopped,
      config: {
        cpu: wizardConfig.cpu,
        memory: wizardConfig.ram,
        disks: [
          {
            path: `/vms/${Date.now()}.qcow2`,
            size: wizardConfig.disk * 1024 * 1024 * 1024,
            format: 'qcow2',
          },
        ],
        network: { type: wizardConfig.network === 'user' ? 'nat' : 'bridge' },
      },
    };
    setVms((prev) => [...prev, newVm]);
    setSelectedId(newVm.id);
    setShowWizard(false);
    addToast('success', `${newVm.name} created successfully`);
  }, [addToast]);

  if (appState === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">⚙️</div>
          <p className="text-gray-600 dark:text-gray-400">Checking QEMU installation...</p>
        </div>
      </div>
    );
  }

  if (appState === 'qemu-setup' && qemuResult) {
    return (
      <div className={`min-h-screen bg-gray-100 dark:bg-gray-900 ${isDarkMode ? 'dark' : ''}`}>
        <QemuSetupWizard
          detectionResult={qemuResult}
          installSuggestion={DEFAULT_INSTALL_SUGGESTION}
          onRetry={checkQemu}
          onSkip={() => setAppState('ready')}
        />
      </div>
    );
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <Button onClick={() => setShowWizard(true)} className="w-full">
          + New VM
        </Button>
      </div>
      <VMListSidebar
        vms={vmListItems}
        selectedId={selectedId}
        onSelect={handleSelect}
        onContextMenu={handleContextMenu}
      />
    </div>
  );

  const toolbar = (
    <div className="flex items-center justify-between w-full">
      <span className="font-semibold text-gray-700 dark:text-gray-200">
        {selectedVm?.name || 'OpenUTM'}
      </span>
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        aria-label="Toggle dark mode"
      >
        {isDarkMode ? '☀️' : '🌙'}
      </button>
    </div>
  );

  return (
    <MainLayout
      sidebar={sidebar}
      toolbar={toolbar}
      isDarkMode={isDarkMode}
      onThemeToggle={() => setIsDarkMode(!isDarkMode)}
    >
      {showWizard ? (
        <VMWizard onComplete={handleWizardComplete} onCancel={() => setShowWizard(false)} />
      ) : selectedVm ? (
        <VMDetailView
          vm={selectedVm}
          onUpdateConfig={handleUpdateConfig}
          onAction={handleAction}
          onDelete={handleDelete}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <p className="text-xl mb-2">No VM Selected</p>
            <p className="text-sm">Select a VM from the sidebar or create a new one</p>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

export default App;
