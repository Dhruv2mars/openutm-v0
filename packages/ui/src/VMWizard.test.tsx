import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import VMWizard from './VMWizard';

describe('VMWizard', () => {
  it('renders the first step (OS Type) initially', () => {
    render(<VMWizard onComplete={() => {}} onCancel={() => {}} />);
    expect(screen.getByText(/Select Operating System/i)).toBeInTheDocument();
  });

  it('navigates to the next step when OS is selected', async () => {
    const user = userEvent.setup();
    render(<VMWizard onComplete={() => {}} onCancel={() => {}} />);
    
    // Select Linux
    const linuxBtn = screen.getByRole('button', { name: /Linux/i });
    await user.click(linuxBtn);
    
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    await user.click(nextBtn);

    expect(screen.getByText(/Select ISO Image/i)).toBeInTheDocument();
  });

  it('detects OS from ISO filename and sets defaults', async () => {
    const user = userEvent.setup();
    render(<VMWizard onComplete={() => {}} onCancel={() => {}} />);

    // Step 1: Linux
    await user.click(screen.getByRole('button', { name: /Linux/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // Step 2: ISO Input
    const fileInput = screen.getByLabelText(/ISO File/i);
    const file = new File(['(⌐□_□)'], 'ubuntu-22.04-desktop-amd64.iso', { type: 'application/x-iso9660-image' });
    await user.upload(fileInput, file);

    // Verify detection message
    expect(screen.getByText(/Detected: Linux/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Next/i }));

    // Step 3: Hardware Defaults for Linux (2GB RAM, 2 Cores, 25GB Disk)
    expect(screen.getByLabelText(/RAM/i)).toHaveValue(2048);
    expect(screen.getByLabelText(/CPU Cores/i)).toHaveValue(2);
    expect(screen.getByLabelText(/Disk Size/i)).toHaveValue(25);
  });

  it('completes the wizard and returns config', async () => {
    const handleComplete = vi.fn();
    const user = userEvent.setup();
    render(<VMWizard onComplete={handleComplete} onCancel={() => {}} />);

    // Step 1: Linux
    await user.click(screen.getByRole('button', { name: /Linux/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // Step 2: ISO
    const fileInput = screen.getByLabelText(/ISO File/i);
    const file = new File([''], 'ubuntu.iso', { type: 'application/x-iso9660-image' });
    await user.upload(fileInput, file);
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // Step 3: Hardware (Keep defaults)
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // Step 4: Network (Default: User)
    expect(screen.getByText(/Network/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // Step 5: Review
    expect(screen.getByText(/Review Settings/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Create VM/i }));

    expect(handleComplete).toHaveBeenCalledTimes(1);
    const config = handleComplete.mock.calls[0][0];
    expect(config.os).toBe('linux');
    expect(config.ram).toBe(2048);
  });
});
