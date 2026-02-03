import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QemuSetupWizard, QemuDetectionResult } from './QemuSetupWizard';

describe('QemuSetupWizard', () => {
  const mockOnRetry = vi.fn();
  const mockOnSkip = vi.fn();

  const qemuNotFound: QemuDetectionResult = {
    available: false,
    path: null,
    version: null,
    accelerators: [],
    minimumVersionMet: false,
  };

  const qemuOutdated: QemuDetectionResult = {
    available: true,
    path: '/usr/bin/qemu-system-x86_64',
    version: 'QEMU emulator version 5.0.0',
    accelerators: ['tcg'],
    minimumVersionMet: false,
  };

  const qemuReady: QemuDetectionResult = {
    available: true,
    path: '/opt/homebrew/bin/qemu-system-aarch64',
    version: 'QEMU emulator version 8.2.0',
    accelerators: ['hvf', 'tcg'],
    minimumVersionMet: true,
  };

  const installSuggestion = 'brew install qemu';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows QEMU Not Found when QEMU is missing', () => {
    render(
      <QemuSetupWizard
        detectionResult={qemuNotFound}
        installSuggestion={installSuggestion}
        onRetry={mockOnRetry}
        onSkip={mockOnSkip}
      />
    );

    expect(screen.getByText('QEMU Not Found')).toBeInTheDocument();
    expect(screen.getByText(/OpenUTM requires QEMU/)).toBeInTheDocument();
  });

  it('shows Update Required when QEMU is outdated', () => {
    render(
      <QemuSetupWizard
        detectionResult={qemuOutdated}
        installSuggestion={installSuggestion}
        onRetry={mockOnRetry}
        onSkip={mockOnSkip}
      />
    );

    expect(screen.getByText('QEMU Update Required')).toBeInTheDocument();
    expect(screen.getByText(/version is outdated/)).toBeInTheDocument();
  });

  it('shows QEMU Ready when QEMU is properly installed', () => {
    render(
      <QemuSetupWizard
        detectionResult={qemuReady}
        installSuggestion={installSuggestion}
        onRetry={mockOnRetry}
      />
    );

    expect(screen.getByText('QEMU Ready')).toBeInTheDocument();
    expect(screen.getByText(/installed and ready/)).toBeInTheDocument();
  });

  it('calls onRetry when Check Again is clicked', () => {
    render(
      <QemuSetupWizard
        detectionResult={qemuNotFound}
        installSuggestion={installSuggestion}
        onRetry={mockOnRetry}
        onSkip={mockOnSkip}
      />
    );

    fireEvent.click(screen.getByText('Check Again'));
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip when Skip is clicked', () => {
    render(
      <QemuSetupWizard
        detectionResult={qemuNotFound}
        installSuggestion={installSuggestion}
        onRetry={mockOnRetry}
        onSkip={mockOnSkip}
      />
    );

    fireEvent.click(screen.getByText('Skip for Now'));
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });

  it('displays install suggestion text', () => {
    render(
      <QemuSetupWizard
        detectionResult={qemuNotFound}
        installSuggestion={installSuggestion}
        onRetry={mockOnRetry}
      />
    );

    expect(screen.getByText(installSuggestion)).toBeInTheDocument();
  });
});
