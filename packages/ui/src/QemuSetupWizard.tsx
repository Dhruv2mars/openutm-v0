import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Card } from './Card';

export interface QemuDetectionResult {
  available: boolean;
  path: string | null;
  version: string | null;
  accelerators: string[];
  minimumVersionMet: boolean;
}

export interface QemuSetupWizardProps {
  detectionResult: QemuDetectionResult;
  installSuggestion: string;
  onRetry: () => void;
  onSkip?: () => void;
  onInstallViaHomebrew?: () => Promise<void>;
}

type SetupStep = 'detecting' | 'missing' | 'outdated' | 'ready';

export const QemuSetupWizard: React.FC<QemuSetupWizardProps> = ({
  detectionResult,
  installSuggestion,
  onRetry,
  onSkip,
  onInstallViaHomebrew,
}) => {
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  const getStep = (): SetupStep => {
    if (!detectionResult.available) return 'missing';
    if (!detectionResult.minimumVersionMet) return 'outdated';
    return 'ready';
  };

  const step = getStep();

  const handleHomebrewInstall = async () => {
    if (!onInstallViaHomebrew) return;
    setIsInstalling(true);
    setInstallError(null);
    try {
      await onInstallViaHomebrew();
      onRetry();
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : 'Installation failed');
    } finally {
      setIsInstalling(false);
    }
  };

  const renderMissingStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">QEMU Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          OpenUTM requires QEMU to run virtual machines. Please install QEMU to continue.
        </p>
      </div>

      <Card className="bg-gray-50 dark:bg-gray-800">
        <h3 className="font-semibold mb-3">Installation Instructions</h3>
        <pre className="text-sm whitespace-pre-wrap bg-white dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
          {installSuggestion}
        </pre>
      </Card>

      {onInstallViaHomebrew && (
        <div className="text-center">
          <Button
            onClick={handleHomebrewInstall}
            disabled={isInstalling}
            variant="primary"
          >
            {isInstalling ? 'Installing...' : 'Install via Homebrew'}
          </Button>
          {installError && (
            <p className="text-red-500 text-sm mt-2">{installError}</p>
          )}
        </div>
      )}

      <div className="flex justify-center gap-4">
        <Button onClick={onRetry} variant="secondary">
          Check Again
        </Button>
        {onSkip && (
          <Button onClick={onSkip} variant="ghost">
            Skip for Now
          </Button>
        )}
      </div>
    </div>
  );

  const renderOutdatedStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">⚡</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">QEMU Update Required</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Your QEMU version is outdated. Please update to version 6.0 or newer.
        </p>
      </div>

      <Card className="bg-gray-50 dark:bg-gray-800">
        <div className="space-y-2">
          <p><strong>Current Path:</strong> {detectionResult.path}</p>
          <p><strong>Detected Version:</strong> {detectionResult.version || 'Unknown'}</p>
          <p><strong>Minimum Required:</strong> 6.0</p>
        </div>
      </Card>

      <Card className="bg-gray-50 dark:bg-gray-800">
        <h3 className="font-semibold mb-3">Update Instructions</h3>
        <pre className="text-sm whitespace-pre-wrap bg-white dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
          {installSuggestion}
        </pre>
      </Card>

      <div className="flex justify-center gap-4">
        <Button onClick={onRetry} variant="secondary">
          Check Again
        </Button>
        {onSkip && (
          <Button onClick={onSkip} variant="ghost">
            Continue Anyway
          </Button>
        )}
      </div>
    </div>
  );

  const renderReadyStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">QEMU Ready</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          QEMU is installed and ready to use.
        </p>
      </div>

      <Card className="bg-green-50 dark:bg-green-900/20">
        <div className="space-y-2">
          <p><strong>Path:</strong> {detectionResult.path}</p>
          <p><strong>Version:</strong> {detectionResult.version?.split('\n')[0] || 'Unknown'}</p>
          <p><strong>Accelerators:</strong> {detectionResult.accelerators.join(', ') || 'None'}</p>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">QEMU Setup</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Checking your system for QEMU installation
        </p>
      </div>

      {step === 'missing' && renderMissingStep()}
      {step === 'outdated' && renderOutdatedStep()}
      {step === 'ready' && renderReadyStep()}
    </div>
  );
};

export default QemuSetupWizard;
