import { MainLayout, VMListSidebar, VMWizard, VMDetailView, DisplayControl } from '@openutm/ui';
import { useState } from 'react';
import './App.css';

function App() {
  const [selectedVM, setSelectedVM] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const mockVMs = [
    { id: '1', name: 'Ubuntu VM', status: 'running' as const },
    { id: '2', name: 'Windows VM', status: 'stopped' as const },
  ];

  const handleCreateVM = () => {
    setShowWizard(true);
  };

  const handleSelectVM = (id: string) => {
    setSelectedVM(id);
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
  };

  return (
    <MainLayout
      sidebar={
        <VMListSidebar
          vms={mockVMs}
          selectedId={selectedVM}
          onSelect={handleSelectVM}
          onCreate={handleCreateVM}
        />
      }
      toolbar={
        <div style={{ display: 'flex', gap: '10px', padding: '10px' }}>
          <button onClick={() => console.log('Start')}>Start</button>
          <button onClick={() => console.log('Stop')}>Stop</button>
          <button onClick={() => console.log('Pause')}>Pause</button>
        </div>
      }
    >
      {showWizard ? (
        <VMWizard onComplete={handleWizardComplete} onCancel={() => setShowWizard(false)} />
      ) : selectedVM ? (
        <VMDetailView vmId={selectedVM} />
      ) : (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Select a VM or create a new one</h2>
          <button onClick={handleCreateVM}>Create VM</button>
        </div>
      )}
      <DisplayControl vmId={selectedVM} isRunning={mockVMs.find(v => v.id === selectedVM)?.status === 'running'} />
    </MainLayout>
  );
}

export default App;
