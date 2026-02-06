import { useState, useCallback, useEffect } from 'react';
import { VMStatus } from '@openutm/shared-types';
import type { VM } from '@openutm/shared-types';
import type { DisplaySession } from '@openutm/shared-types';
import {
  MainLayout,
  VMListSidebar,
  VMDetailView,
  VMWizard,
  Button,
  QemuSetupWizard,
  useToast,
  type VMConfig as WizardConfig,
  type VMListItem,
  type QemuDetectionResult,
} from '@openutm/ui';
import {
  clearManagedRuntimeViaBackend,
  createVmViaBackend,
  deleteVmViaBackend,
  detectQemuViaBackend,
  getRuntimeStatusViaBackend,
  installManagedRuntimeViaBackend,
  listVmsViaBackend,
  pauseVmViaBackend,
  openDisplayViaBackend,
  getDisplayViaBackend,
  closeDisplayViaBackend,
  resumeVmViaBackend,
  startVmViaBackend,
  stopVmViaBackend,
  updateVmViaBackend,
} from './backend';
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

type AppState = 'loading' | 'qemu-setup' | 'ready';

const DEFAULT_INSTALL_SUGGESTION = `macOS: Install QEMU using Homebrew:
  brew install qemu

Alternatively, download from: https://www.qemu.org/download/#macos`;
const RUNTIME_BLOCK_REASON = 'Install OpenUTM Runtime to enable SPICE display';

function inferOs(vm: VM): VMListItem['os'] {
  const value = vm.name.toLowerCase();
  if (value.includes('win')) return 'Windows';
  if (value.includes('ubuntu') || value.includes('debian') || value.includes('fedora') || value.includes('linux')) {
    return 'Linux';
  }
  if (value.includes('mac')) return 'macOS';
  return 'Other';
}

function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [qemuResult, setQemuResult] = useState<QemuDetectionResult | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(true);
  const [runtimeInstalling, setRuntimeInstalling] = useState(false);
  const [runtimeInstallError, setRuntimeInstallError] = useState<string | null>(null);
  const [vms, setVms] = useState<VM[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [displaySessions, setDisplaySessions] = useState<Record<string, DisplaySession | null>>({});
  const { addToast } = useToast();

  const refreshVms = useCallback(async () => {
    const next = await listVmsViaBackend();
    setVms(next);
    setSelectedId((current) => {
      if (current && next.some((vm) => vm.id === current)) {
        return current;
      }
      return next[0]?.id;
    });
  }, []);

  const checkQemu = useCallback(async () => {
    setAppState('loading');
    try {
      const result = await detectQemuViaBackend();
      setQemuResult(result);
      setRuntimeReady(result.ready);
      setRuntimeInstallError(null);
      if (result.available && result.minimumVersionMet) {
        await refreshVms();
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
      setRuntimeReady(false);
      setAppState('qemu-setup');
      addToast('error', error instanceof Error ? error.message : 'Failed to detect QEMU installation');
    }
  }, [addToast, refreshVms]);

  useEffect(() => {
    void checkQemu();
  }, [checkQemu]);

  const selectedVm = vms.find((vm) => vm.id === selectedId);
  const selectedDisplay = selectedId ? (displaySessions[selectedId] || null) : null;
  const runtimeBlocked = !runtimeReady;

  const vmListItems: VMListItem[] = vms.map((vm) => ({
    id: vm.id,
    name: vm.name,
    status: vmStatusToListStatus(vm.status),
    os: inferOs(vm),
  }));

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setShowWizard(false);
  }, []);

  const handleContextMenu = useCallback(
    async (id: string, action: 'start' | 'stop' | 'delete') => {
      const vm = vms.find((item) => item.id === id);
      const vmName = vm?.name || 'VM';

      try {
        if (action === 'delete') {
          await deleteVmViaBackend(id);
          await refreshVms();
          addToast('success', `${vmName} deleted`);
          return;
        }

        if (action === 'start') {
          if (runtimeBlocked) {
            addToast('error', RUNTIME_BLOCK_REASON);
            return;
          }
          await startVmViaBackend(id);
          addToast('success', `${vmName} started`);
        } else {
          await stopVmViaBackend(id);
          addToast('success', `${vmName} stopped`);
        }

        await refreshVms();
      } catch (error) {
        addToast('error', error instanceof Error ? error.message : 'VM action failed');
      }
    },
    [addToast, refreshVms, runtimeBlocked, vms]
  );

  const handleAction = useCallback(
    async (id: string, action: 'start' | 'stop' | 'pause' | 'resume' | 'shutdown') => {
      const vm = vms.find((item) => item.id === id);
      const vmName = vm?.name || 'VM';

      try {
        switch (action) {
          case 'start':
            if (runtimeBlocked) {
              addToast('error', RUNTIME_BLOCK_REASON);
              return;
            }
            await startVmViaBackend(id);
            addToast('success', `${vmName} started`);
            break;
          case 'stop':
          case 'shutdown':
            await stopVmViaBackend(id);
            addToast('success', `${vmName} stopped`);
            break;
          case 'pause':
            await pauseVmViaBackend(id);
            addToast('success', `${vmName} paused`);
            break;
          case 'resume':
            await resumeVmViaBackend(id);
            addToast('success', `${vmName} resumed`);
            break;
        }

        await refreshVms();
      } catch (error) {
        addToast('error', error instanceof Error ? error.message : 'VM action failed');
      }
    },
    [addToast, refreshVms, runtimeBlocked, vms]
  );

  const handleUpdateConfig = useCallback(
    async (id: string, config: Partial<VM['config']>) => {
      try {
        const updated = await updateVmViaBackend({
          id,
          cpu: config.cpu,
          memory: config.memory,
        });

        setVms((previous) => previous.map((vm) => (vm.id === id ? updated : vm)));
        addToast('info', 'Configuration updated');
      } catch (error) {
        addToast('error', error instanceof Error ? error.message : 'Failed to update VM configuration');
      }
    },
    [addToast]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const vm = vms.find((item) => item.id === id);
        await deleteVmViaBackend(id);
        setDisplaySessions((previous) => {
          const next = { ...previous };
          delete next[id];
          return next;
        });
        await refreshVms();
        addToast('success', `${vm?.name || 'VM'} deleted`);
      } catch (error) {
        addToast('error', error instanceof Error ? error.message : 'Failed to delete VM');
      }
    },
    [addToast, refreshVms, vms]
  );

  const syncDisplaySession = useCallback(async (vmId: string) => {
    try {
      const session = await getDisplayViaBackend(vmId);
      setDisplaySessions((previous) => ({ ...previous, [vmId]: session }));
    } catch {
      setDisplaySessions((previous) => ({ ...previous, [vmId]: null }));
    }
  }, []);

  const handleOpenDisplay = useCallback(
    async (vmId: string) => {
      try {
        if (runtimeBlocked) {
          addToast('error', RUNTIME_BLOCK_REASON);
          return;
        }
        const session = await openDisplayViaBackend(vmId);
        setDisplaySessions((previous) => ({ ...previous, [vmId]: session }));
        addToast('info', `Display endpoint: ${session.uri}`);
      } catch (error) {
        addToast('error', error instanceof Error ? error.message : 'Failed to open display');
      }
    },
    [addToast, runtimeBlocked]
  );

  const handleInstallManagedRuntime = useCallback(async () => {
    setRuntimeInstalling(true);
    setRuntimeInstallError(null);
    try {
      const status = await installManagedRuntimeViaBackend();
      setRuntimeReady(status.ready);
      await checkQemu();
      if (status.ready) {
        addToast('success', 'OpenUTM runtime installed');
      } else {
        setRuntimeInstallError('Managed runtime installed but SPICE is still unavailable');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to install OpenUTM runtime';
      setRuntimeInstallError(message);
      addToast('error', message);
    } finally {
      setRuntimeInstalling(false);
    }
  }, [addToast, checkQemu]);

  const handleClearManagedRuntime = useCallback(async () => {
    try {
      await clearManagedRuntimeViaBackend();
      const status = await getRuntimeStatusViaBackend();
      setRuntimeReady(status.ready);
      await checkQemu();
      addToast('info', 'Managed runtime cleared');
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to clear managed runtime');
    }
  }, [addToast, checkQemu]);

  const handleCloseDisplay = useCallback(
    async (vmId: string) => {
      try {
        await closeDisplayViaBackend(vmId);
        await syncDisplaySession(vmId);
        addToast('info', 'Display session closed');
      } catch (error) {
        addToast('error', error instanceof Error ? error.message : 'Failed to close display');
      }
    },
    [addToast, syncDisplaySession]
  );

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    let active = true;
    const tick = async () => {
      try {
        const session = await getDisplayViaBackend(selectedId);
        if (!active) return;
        setDisplaySessions((previous) => ({ ...previous, [selectedId]: session }));
      } catch {
        if (!active) return;
        setDisplaySessions((previous) => ({ ...previous, [selectedId]: null }));
      }
    };

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, 2000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedId]);

  const handleWizardComplete = useCallback(
    async (wizardConfig: WizardConfig) => {
      try {
        const vmName = `${wizardConfig.os.charAt(0).toUpperCase() + wizardConfig.os.slice(1)} VM`;
        const vm = await createVmViaBackend({
          name: vmName,
          cpu: wizardConfig.cpu,
          memory: wizardConfig.ram,
          diskSizeGb: wizardConfig.disk,
          networkType: wizardConfig.network === 'user' ? 'nat' : 'bridge',
          os: wizardConfig.os,
        });

        setShowWizard(false);
        await refreshVms();
        setSelectedId(vm.id);
        addToast('success', `${vm.name} created successfully`);
      } catch (error) {
        addToast('error', error instanceof Error ? error.message : 'Failed to create VM');
      }
    },
    [addToast, refreshVms]
  );

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
          onRetry={() => void checkQemu()}
          onSkip={() => {
            setAppState('ready');
            void refreshVms();
          }}
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
        {selectedVm?.name || 'OpenUTM (Electron)'}
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

  const runtimeBanner = runtimeBlocked ? (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
      <p className="text-sm font-medium text-amber-900">Display blocked: SPICE runtime unavailable.</p>
      <p className="text-xs text-amber-800">
        Install OpenUTM Runtime to start VMs and use in-app display.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => void handleInstallManagedRuntime()} disabled={runtimeInstalling}>
          {runtimeInstalling ? 'Installing OpenUTM Runtime...' : 'Install OpenUTM Runtime'}
        </Button>
        <Button variant="secondary" onClick={() => void checkQemu()}>
          Retry
        </Button>
        <Button variant="ghost" onClick={() => void handleClearManagedRuntime()}>
          Clear Managed Runtime
        </Button>
      </div>
      {runtimeInstallError ? <p className="text-xs text-red-700">{runtimeInstallError}</p> : null}
    </div>
  ) : null;

  return (
    <MainLayout
      sidebar={sidebar}
      toolbar={toolbar}
      isDarkMode={isDarkMode}
      onThemeToggle={() => setIsDarkMode(!isDarkMode)}
    >
      <div className="space-y-4">
        {runtimeBanner}
        {showWizard ? (
          <VMWizard onComplete={handleWizardComplete} onCancel={() => setShowWizard(false)} />
        ) : selectedVm ? (
          <VMDetailView
            vm={selectedVm}
            displaySession={selectedDisplay}
            onOpenDisplay={(id) => void handleOpenDisplay(id)}
            onCloseDisplay={(id) => void handleCloseDisplay(id)}
            onUpdateConfig={handleUpdateConfig}
            onAction={handleAction}
            onDelete={handleDelete}
            disableStart={runtimeBlocked}
            disableStartReason={RUNTIME_BLOCK_REASON}
            disableDisplayOpen={runtimeBlocked}
            disableDisplayOpenReason={RUNTIME_BLOCK_REASON}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-xl mb-2">No VM Selected</p>
              <p className="text-sm">Select a VM from the sidebar or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default App;
