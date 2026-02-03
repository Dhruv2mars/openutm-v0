import { MainLayout, VMListSidebar, VMWizard, VMDetailView, DisplayControl } from '@openutm/ui';
import { useState } from 'react';
import './App.css';
import type { VM } from '@openutm/shared-types';

function App() {
  const [selectedVM, setSelectedVM] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const mockVMs = [
    { id: '1', name: 'Ubuntu VM', status: 'running' as const, os: 'Linux' },
    { id: '2', name: 'Windows VM', status: 'stopped' as const, os: 'Windows' },
  ];

  const mockVM: VM = {
    id: selectedVM || '1',
    name: 'Test VM',
    status: 'running',
    config: {
      id: '1',
      vmId: selectedVM || '1',
      cpu: 2,
      memory: 4096,
      drives: [],
      network: { type: 'nat' },
    },
  };

  const handleCreateVM = () => {
    setShowWizard(true);
  };

  const handleSelectVM = (id: string) => {
    setSelectedVM(id);
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
  };

  const handleContextMenu = (id: string, action: 'start' | 'stop' | 'delete') => {
    console.log(`Action ${action} on VM ${id}`);
  };

  return (
    <MainLayout
      sidebar={
        <VMListSidebar
          vms={mockVMs}
          selectedId={selectedVM || undefined}
          onSelect={handleSelectVM}
          onContextMenu={handleContextMenu}
        />
      }
      toolbar={
        <div style={{ display: 'flex', gap: '10px', padding: '10px' }}>
          <button onClick={() => console.log('Start')}>Start</button>
          <button onClick={() => console.log('Stop')}>Stop</button>
          <button onClick={() => console.log('Pause')}>Pause</button>
        </div>
      }
      isDarkMode={isDarkMode}
      onThemeToggle={() => setIsDarkMode(!isDarkMode)}
    >
      {showWizard ? (
        <VMWizard onComplete={handleWizardComplete} onCancel={() => setShowWizard(false)} />
      ) : selectedVM ? (
        <VMDetailView 
          vm={mockVM}
          onUpdateConfig={(id, config) => console.log('Update', id, config)}
          onAction={(id, action) => console.log('Action', id, action)}
          onDelete={(id) => console.log('Delete', id)}
        />
      ) : (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Select a VM or create a new one</h2>
          <button onClick={handleCreateVM}>Create VM</button>
        </div>
      )}
      <DisplayControl 
        onOpenDisplay={() => console.log('Open display')}
        status={mockVMs.find(v => v.id === selectedVM)?.status || 'stopped'}
      />
    </MainLayout>
  );
}

export default App;
