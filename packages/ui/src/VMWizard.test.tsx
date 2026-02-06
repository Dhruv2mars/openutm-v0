import { render, screen, fireEvent } from '@testing-library/react';
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

  it('calls onCancel from first step back button', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<VMWizard onComplete={() => {}} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('goes back to previous step when not at first step', async () => {
    const user = userEvent.setup();
    render(<VMWizard onComplete={() => {}} onCancel={() => {}} />);

    await user.click(screen.getByRole('button', { name: /Linux/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByText(/Select ISO Image/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Back/i }));
    expect(screen.getByText(/Select Operating System/i)).toBeInTheDocument();
  });

  it('applies windows defaults from OS selection', async () => {
    const user = userEvent.setup();
    render(<VMWizard onComplete={() => {}} onCancel={() => {}} />);

    await user.click(screen.getByRole('button', { name: /Windows/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    expect(screen.getByLabelText(/RAM/i)).toHaveValue(4096);
    expect(screen.getByLabelText(/CPU Cores/i)).toHaveValue(2);
    expect(screen.getByLabelText(/Disk Size/i)).toHaveValue(50);
  });

  it('detects windows ISO and updates defaults', async () => {
    const user = userEvent.setup();
    render(<VMWizard onComplete={() => {}} onCancel={() => {}} />);

    await user.click(screen.getByRole('button', { name: /Linux/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    const fileInput = screen.getByLabelText(/ISO File/i);
    const file = new File([''], 'win11-install.iso', { type: 'application/x-iso9660-image' });
    await user.upload(fileInput, file);
    expect(screen.getByText(/Detected: Windows/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByLabelText(/RAM/i)).toHaveValue(4096);
    expect(screen.getByLabelText(/CPU Cores/i)).toHaveValue(2);
    expect(screen.getByLabelText(/Disk Size/i)).toHaveValue(50);
  });

  it('detects macOS ISO and updates defaults', async () => {
    const user = userEvent.setup();
    render(<VMWizard onComplete={() => {}} onCancel={() => {}} />);

    await user.click(screen.getByRole('button', { name: /Linux/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    const fileInput = screen.getByLabelText(/ISO File/i);
    const file = new File([''], 'macos-sonoma.iso', { type: 'application/x-iso9660-image' });
    await user.upload(fileInput, file);
    expect(screen.getByText(/Detected: Macos/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByLabelText(/RAM/i)).toHaveValue(4096);
    expect(screen.getByLabelText(/CPU Cores/i)).toHaveValue(4);
    expect(screen.getByLabelText(/Disk Size/i)).toHaveValue(64);
  });

  it('keeps selected defaults for unknown ISO and no detection banner', async () => {
    const user = userEvent.setup();
    render(<VMWizard onComplete={() => {}} onCancel={() => {}} />);

    await user.click(screen.getByRole('button', { name: /Other/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    const fileInput = screen.getByLabelText(/ISO File/i);
    const file = new File([''], 'custom-build.iso', { type: 'application/x-iso9660-image' });
    await user.upload(fileInput, file);
    expect(screen.queryByText(/Detected:/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByLabelText(/RAM/i)).toHaveValue(2048);
    expect(screen.getByLabelText(/CPU Cores/i)).toHaveValue(2);
    expect(screen.getByLabelText(/Disk Size/i)).toHaveValue(20);
  });

  it('edits hardware and bridged network before create', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<VMWizard onComplete={onComplete} onCancel={() => {}} />);

    await user.click(screen.getByRole('button', { name: /Linux/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    const ram = screen.getByLabelText(/RAM/i);
    const cpu = screen.getByLabelText(/CPU Cores/i);
    const disk = screen.getByLabelText(/Disk Size/i);
    await user.clear(ram);
    await user.type(ram, '8192');
    await user.clear(cpu);
    await user.type(cpu, '6');
    await user.clear(disk);
    await user.type(disk, '120');

    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Bridged/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Create VM/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({
      ram: 8192,
      cpu: 6,
      disk: 120,
      network: 'bridged',
    });
  });

  it('supports explicit User network selection', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<VMWizard onComplete={onComplete} onCancel={() => {}} />);

    await user.click(screen.getByRole('button', { name: /Linux/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    await user.click(screen.getByRole('button', { name: /User \(NAT\)/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Create VM/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].network).toBe('user');
  });

  it('ignores ISO change when no file selected', async () => {
    const user = userEvent.setup();
    render(<VMWizard onComplete={() => {}} onCancel={() => {}} />);

    await user.click(screen.getByRole('button', { name: /Linux/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    const fileInput = screen.getByLabelText(/ISO File/i);
    fireEvent.change(fileInput, { target: { files: [] } });

    expect(screen.queryByText(/Detected:/i)).not.toBeInTheDocument();
  });
});
