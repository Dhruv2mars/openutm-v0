import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';

export interface VMWizardProps {
  onComplete: (config: VMConfig) => void;
  onCancel: () => void;
  onPickInstallMedia?: (vmId?: string) => Promise<string | null> | string | null;
}

export interface VMConfig {
  os: 'linux' | 'windows' | 'macos' | 'other';
  isoFile: File | null;
  installMediaPath: string | null;
  ram: number;
  cpu: number;
  disk: number;
  network: 'user' | 'bridged';
}

const STEPS = [
  'Select Operating System',
  'Select ISO Image',
  'Hardware Configuration',
  'Network Configuration',
  'Review Settings'
];

const VMWizard: React.FC<VMWizardProps> = ({ onComplete, onCancel, onPickInstallMedia }) => {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<VMConfig>({
    os: 'linux',
    isoFile: null,
    installMediaPath: null,
    ram: 2048,
    cpu: 2,
    disk: 25,
    network: 'user'
  });
  const [osDetected, setOsDetected] = useState<string | null>(null);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(config);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      onCancel();
    }
  };

  const selectOS = (os: VMConfig['os']) => {
    setConfig({ ...config, os });
    // Set initial defaults based on OS selection if not already set by ISO
    const defaults = getDefaults(os);
    setConfig(prev => ({ ...prev, os, ...defaults }));
  };

  const getDefaults = (os: string) => {
    switch (os) {
      case 'linux': return { ram: 2048, cpu: 2, disk: 25 };
      case 'windows': return { ram: 4096, cpu: 2, disk: 50 };
      case 'macos': return { ram: 4096, cpu: 4, disk: 64 };
      default: return { ram: 2048, cpu: 2, disk: 20 };
    }
  };

  const handleIsoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const detected = detectOS(file.name);
      setConfig(prev => ({
        ...prev,
        isoFile: file,
        installMediaPath: file.name,
        os: detected || prev.os,
        ...getDefaults(detected || prev.os)
      }));
      setOsDetected(detected ? `Detected: ${detected.charAt(0).toUpperCase() + detected.slice(1)}` : null);
    }
  };

  const handlePickInstallMedia = async () => {
    const selectedPath = await onPickInstallMedia?.();
    if (!selectedPath) {
      return;
    }

    const parts = selectedPath.split(/[\\/]/);
    const filename = parts[parts.length - 1];
    const detected = detectOS(filename);
    setConfig((prev) => ({
      ...prev,
      isoFile: null,
      installMediaPath: selectedPath,
      os: detected || prev.os,
      ...getDefaults(detected || prev.os),
    }));
    setOsDetected(detected ? `Detected: ${detected.charAt(0).toUpperCase() + detected.slice(1)}` : null);
  };

  const detectOS = (filename: string): VMConfig['os'] | null => {
    const lower = filename.toLowerCase();
    if (lower.includes('ubuntu') || lower.includes('debian') || lower.includes('fedora') || lower.includes('linux')) return 'linux';
    if (lower.includes('windows') || lower.includes('win10') || lower.includes('win11')) return 'windows';
    if (lower.includes('macos') || lower.includes('osx')) return 'macos';
    return null;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">{STEPS[step]}</h1>
      
      <div className="mb-6">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-4">
            {['linux', 'windows', 'macos', 'other'].map((os) => (
              <Button
                key={os}
                variant={config.os === os ? 'primary' : 'secondary'}
                onClick={() => selectOS(os as any)}
                className="capitalize"
              >
                {os}
              </Button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {onPickInstallMedia ? (
              <div className="space-y-3">
                <Button onClick={() => void handlePickInstallMedia()} variant="secondary">
                  Choose ISO
                </Button>
                {config.installMediaPath ? (
                  <p className="text-sm text-gray-600 break-all">{config.installMediaPath}</p>
                ) : (
                  <p className="text-sm text-gray-500">No install media selected.</p>
                )}
              </div>
            ) : (
              <label className="block text-sm font-medium text-gray-700">
                ISO File
                <input
                  type="file"
                  accept=".iso,.img"
                  onChange={handleIsoChange}
                  className="mt-1 block w-full"
                  aria-label="ISO File"
                />
              </label>
            )}
            {osDetected && (
              <div className="p-2 bg-green-100 text-green-800 rounded">
                {osDetected}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Input
              label="RAM (MB)"
              type="number"
              value={config.ram}
              onChange={(e) => setConfig({ ...config, ram: parseInt(e.target.value) })}
            />
            <Input
              label="CPU Cores"
              type="number"
              value={config.cpu}
              onChange={(e) => setConfig({ ...config, cpu: parseInt(e.target.value) })}
            />
            <Input
              label="Disk Size (GB)"
              type="number"
              value={config.disk}
              onChange={(e) => setConfig({ ...config, disk: parseInt(e.target.value) })}
            />
          </div>
        )}

        {step === 3 && (
          <div className="flex gap-4">
            <Button
              variant={config.network === 'user' ? 'primary' : 'secondary'}
              onClick={() => setConfig({ ...config, network: 'user' })}
            >
              User (NAT)
            </Button>
            <Button
              variant={config.network === 'bridged' ? 'primary' : 'secondary'}
              onClick={() => setConfig({ ...config, network: 'bridged' })}
            >
              Bridged
            </Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-2">
            <p><strong>OS:</strong> {config.os}</p>
            <p><strong>ISO:</strong> {config.installMediaPath || config.isoFile?.name || 'None'}</p>
            <p><strong>RAM:</strong> {config.ram} MB</p>
            <p><strong>CPU:</strong> {config.cpu} Cores</p>
            <p><strong>Disk:</strong> {config.disk} GB</p>
            <p><strong>Network:</strong> {config.network}</p>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-8">
        <Button onClick={handleBack} variant="ghost">
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Button onClick={handleNext} variant="primary">
          {step === STEPS.length - 1 ? 'Create VM' : 'Next'}
        </Button>
      </div>
    </Card>
  );
};

export default VMWizard;
